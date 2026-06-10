import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Reward from '@/models/Reward';

const defaultRewards = [
  // Starter Rewards (low cost)
  {
    name: "€20 Free Bet",
    description: "Free bet at Bwin",
    cost: 2000,
    partner: "Bwin",
    icon: "Ticket",
    category: "starter",
    active: true,
    stock: -1,
  },
  {
    name: "SportTock Merch",
    description: "Exclusive T-shirt or cap",
    cost: 3000,
    partner: "SportTock",
    icon: "Shirt",
    category: "starter",
    active: true,
    stock: -1,
  },
  // Standard Rewards
  {
    name: "DAZN 1 Month",
    description: "One month free streaming",
    cost: 4000,
    partner: "DAZN",
    icon: "Tv",
    category: "standard",
    active: true,
    stock: -1,
  },
  {
    name: "€50 Free Bet",
    description: "Free bet at Bwin",
    cost: 5000,
    partner: "Bwin",
    icon: "Ticket",
    category: "standard",
    active: true,
    stock: -1,
  },
  {
    name: "€100 Free Bet",
    description: "Free bet at Bwin",
    cost: 10000,
    partner: "Bwin",
    icon: "Ticket",
    category: "standard",
    active: true,
    stock: -1,
  },
  {
    name: "DAZN 3 Months",
    description: "Stream all Bundesliga games live",
    cost: 10000,
    partner: "DAZN",
    icon: "Tv",
    category: "standard",
    active: true,
    stock: -1,
  },
  // Premium Rewards
  {
    name: "€500 Free Bet",
    description: "Free bet at Bwin",
    cost: 50000,
    partner: "Bwin",
    icon: "Ticket",
    category: "premium",
    active: true,
    stock: -1,
  },
  {
    name: "DAZN 1 Year Free",
    description: "12 months free streaming",
    cost: 50000,
    partner: "DAZN",
    icon: "Tv",
    category: "premium",
    active: true,
    stock: -1,
  },
  {
    name: "PS5 + EA FC Bundle",
    description: "PlayStation 5 with EA Sports FC 25",
    cost: 100000,
    partner: "Sony",
    icon: "Gamepad2",
    category: "premium",
    active: true,
    stock: 10,
  },
  {
    name: "Signed Jersey",
    description: "Original jersey signed by your favorite player",
    cost: 250000,
    partner: "SportTock",
    icon: "Star",
    category: "premium",
    active: true,
    stock: 5,
  },
];

export async function POST() {
  try {
    await dbConnect();
    
    // Check if rewards already exist
    const existingCount = await Reward.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json({ 
        message: `Rewards already exist (${existingCount} found). Delete them first to reseed.`,
        count: existingCount 
      });
    }
    
    // Insert default rewards
    const result = await Reward.insertMany(defaultRewards);
    
    return NextResponse.json({ 
      success: true, 
      message: `Created ${result.length} default rewards`,
      rewards: result 
    });
  } catch (error) {
    console.error('Error seeding rewards:', error);
    return NextResponse.json({ error: 'Failed to seed rewards' }, { status: 500 });
  }
}
