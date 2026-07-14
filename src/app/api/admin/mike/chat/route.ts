import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import MikeTask from '@/models/MikeTask';
import { combinePrompts } from '@/lib/loadPrompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load modular prompts: core + mike rules
function loadSystemPrompt(): string {
  return combinePrompts(['core.txt', 'mike.txt']);
}

// Scan project files
function getProjectFiles(): string {
  const srcPath = path.join(process.cwd(), 'src');
  const files: string[] = [];
  
  function scanDir(dir: string, prefix: string = '') {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = prefix + '/' + item;
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(relativePath + '/');
          scanDir(fullPath, relativePath);
        } else if (item.endsWith('.tsx') || item.endsWith('.ts') || item.endsWith('.txt')) {
          files.push(relativePath);
        }
      }
    } catch {
      // ignore errors
    }
  }
  
  scanDir(srcPath, '/src');
  return files.join('\n');
}

// Fetch live data for Mike
async function getLiveData(): Promise<string> {
  try {
    await dbConnect();
    
    const [
      totalUsers,
      verifiedUsers,
      adminUsers,
      recentUsers,
      openTasks,
      inProgressTasks
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isAdmin: true }),
      User.find().sort({ createdAt: -1 }).limit(5).select('username email createdAt').lean(),
      MikeTask.countDocuments({ status: { $in: ['Draft', 'Backlog', 'Ready for Review'] } }),
      MikeTask.countDocuments({ status: 'In Progress' })
    ]);
    
    const projectFiles = getProjectFiles();
    
    return `
LIVE DATEN (aktuell aus der Datenbank):
- Gesamt User: ${totalUsers}
- Verifizierte User: ${verifiedUsers}
- Admins: ${adminUsers}
- Letzte 5 Registrierungen: ${recentUsers.map((u: { username?: string; email?: string }) => u.username || u.email).join(', ')}
- Offene Tasks: ${openTasks}
- In Progress: ${inProgressTasks}

PROJEKT-DATEIEN (alle .ts/.tsx/.txt in /src):
${projectFiles}
`;
  } catch (error) {
    console.error('Failed to fetch live data:', error);
    return '\nLIVE DATEN: Konnte nicht geladen werden.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, image, history, pendingTicket, context, ticketId } = await request.json();
    
    if (!message && !image) {
      return NextResponse.json({ success: false, error: 'No message' }, { status: 400 });
    }

    await dbConnect();

    // Load current ticket if ticketId provided
    let currentTicket = null;
    if (ticketId) {
      currentTicket = await MikeTask.findById(ticketId).lean();
    }

    // Load system prompt and live data
    const systemPrompt = loadSystemPrompt();
    const liveData = await getLiveData();
    
    // Build ticket context for Mike
    let ticketContext = '';
    if (currentTicket) {
      const hasIssue = currentTicket.notes?.includes('ISSUE REPORTED');
      ticketContext = `

================================================================================
WICHTIG: DU HAST KONTEXT! LIES DAS!
================================================================================

AKTUELLES TICKET (User schaut gerade auf dieses Ticket):
- Titel: ${currentTicket.title}
- Status: ${currentTicket.status}
- Beschreibung: ${currentTicket.description}
- Requirements/Spec: ${currentTicket.aiSuggestions || 'keine'}
- Notes: ${currentTicket.notes || 'keine'}
${currentTicket.chatMessages?.length > 0 ? `
BISHERIGE CHAT-HISTORY (was bereits besprochen wurde):
${currentTicket.chatMessages.map((m: {role: string; content: string}) => `${m.role === 'user' ? 'User' : 'Mike'}: ${m.content}`).join('\n')}
` : ''}
${hasIssue ? `
⚠️ ES GIBT EIN ISSUE! Der User hat ein Problem gemeldet - siehe Notes oben!
` : ''}

ERLAUBTE AKTIONEN IN DIESEM CHAT:
- {"action": "update", "field": "status", "value": "Completed"}
- {"action": "update", "field": "status", "value": "Testing"}
- {"action": "update", "field": "notes", "value": "..."}
- {"action": "forward-to-cascade", "message": "..."}
`;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      { role: 'system', content: systemPrompt + '\n\nAKTIVE AUFGABE: AUFGABE 9 - MIKE - DEVELOPMENT MANAGER & WISSENSBASIS\n' + liveData + ticketContext }
    ];
    
    // Add chat history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // Add context about pending ticket if exists
    if (pendingTicket) {
      messages.push({
        role: 'system',
        content: `Current pending ticket: ${JSON.stringify(pendingTicket)}. User may want to modify it.`
      });
    }
    
    // Add current message (with image if provided)
    if (image) {
      messages.push({ 
        role: 'user', 
        content: [
          { type: 'text', text: message || 'Was siehst du auf diesem Bild?' },
          { type: 'image_url', image_url: { url: image } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Save chat to chatHistory string (simpler, works with existing schema)
    if (ticketId) {
      try {
        const ticket = await MikeTask.findById(ticketId);
        if (ticket) {
          const newChat = `\nUser: ${message}\nMike: ${responseText}`;
          ticket.chatHistory = (ticket.chatHistory || '') + newChat;
          await ticket.save();
          console.log('Chat saved to chatHistory');
        }
      } catch (dbError) {
        console.error('Failed to save chat to DB:', dbError);
      }
    }

    // Check if response contains an action JSON
    let ticketUpdated = false;
    let cascadeAsked = false;
    
    // Check for forward-to-cascade action (Cascade is already in chat)
    const forwardMatch = responseText.match(/\{"action":\s*"forward-to-cascade"[\s\S]*?\}/);
    if (forwardMatch && ticketId) {
      try {
        const action = JSON.parse(forwardMatch[0]);
        if (action.action === 'forward-to-cascade') {
          // Cascade responds directly - write to queue for polling
          const queuePath = path.join(process.cwd(), 'src', 'cascade-queue.json');
          let queue: Record<string, unknown> = { status: 'idle', tasks: [] };
          try {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
          } catch { /* ignore */ }
          
          queue.cascadeResponse = {
            ticketId,
            message: `Ich hab deine Nachricht bekommen: "${action.message || message}". Was genau brauchst du?`,
            respondedAt: new Date().toISOString()
          };
          fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
          cascadeAsked = true;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
    
    // Check for ask-cascade action (bring Cascade into chat)
    const askCascadeMatch = responseText.match(/\{"action":\s*"ask-cascade"[\s\S]*?\}/);
    if (askCascadeMatch && ticketId && !cascadeAsked) {
      try {
        const action = JSON.parse(askCascadeMatch[0]);
        if (action.action === 'ask-cascade') {
          // Write to cascade-queue.json so Cascade sees it
          const queuePath = path.join(process.cwd(), 'src', 'cascade-queue.json');
          let queue: Record<string, unknown> = { status: 'idle', tasks: [] };
          try {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
          } catch { /* ignore */ }
          
          queue.cascadeResponse = {
            ticketId,
            message: `[CASCADE] Hey! Ich bin jetzt im Chat. Was brauchst du zum Ticket "${currentTicket?.title}"?`,
            respondedAt: new Date().toISOString()
          };
          fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
          cascadeAsked = true;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
    
    // Check for update action
    const actionMatch = responseText.match(/\{"action":\s*"update"[\s\S]*?\}/);
    if (actionMatch && ticketId) {
      try {
        const action = JSON.parse(actionMatch[0]);
        if (action.action === 'update' && action.field && action.value) {
          await MikeTask.findByIdAndUpdate(ticketId, { [action.field]: action.value });
          ticketUpdated = true;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
    
    // Check if response contains a new ticket JSON
    let ticket = null;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        ticket = JSON.parse(jsonMatch[1]);
      } catch {
        // Invalid JSON, ignore
      }
    }
    
    // Clean response (remove JSON blocks for display)
    let cleanResponse = responseText
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/\{"action":\s*"update"[\s\S]*?\}/g, '')
      .replace(/\{"action":\s*"ask-cascade"[\s\S]*?\}/g, '')
      .replace(/\{"action":\s*"forward-to-cascade"[\s\S]*?\}/g, '')
      .replace(/\.\.\./g, '') // Remove "..." placeholder
      .trim();
    
    if (cascadeAsked) {
      // Mike stays quiet, Cascade responds
      cleanResponse = '';
    } else if (ticketUpdated) {
      cleanResponse = cleanResponse || 'Done. Ticket updated.';
    }
    
    return NextResponse.json({ 
      success: true, 
      response: cleanResponse || '',
      ticket,
      cascadeAsked,
      ticketUpdated
    });
    
  } catch (error) {
    console.error('Mike chat error:', error);
    return NextResponse.json({ success: false, error: 'Chat failed' }, { status: 500 });
  }
}
