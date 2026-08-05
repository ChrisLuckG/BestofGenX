const url = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/deaths/08/05';

fetch(url, { headers: { 'User-Agent': 'BOGX-Test/1.0' } })
  .then(res => res.json())
  .then(j => {
    console.log('Total deaths:', j.deaths.length);
    
    const genx = j.deaths.filter(d => {
      const t = d.text || '';
      const desc = d.pages?.[0]?.description || '';
      
      // Method 1: born YYYY in text
      const m1 = t.match(/born\s*(?:c\.?\s*)?(\d{4})/i);
      if (m1 && parseInt(m1[1]) >= 1965 && parseInt(m1[1]) <= 1980) return true;
      
      // Method 2: (YYYY-YYYY) in description
      const m2 = desc.match(/\((\d{4})[-–]/);
      if (m2 && parseInt(m2[1]) >= 1965 && parseInt(m2[1]) <= 1980) return true;
      
      // Method 3: aged XX - calculate birth year
      const m3 = desc.match(/aged?\s*(\d{2,3})/i);
      if (m3) {
        const birthYear = d.year - parseInt(m3[1]);
        if (birthYear >= 1965 && birthYear <= 1980) return true;
      }
      
      return false;
    });
    
    console.log('\nGenX deaths (born 1965-1980):', genx.length);
    genx.forEach(d => {
      const desc = d.pages?.[0]?.description || '';
      console.log('-', d.text?.split('.')[0], '| died', d.year, '|', desc);
    });
  })
  .catch(e => console.error('Error:', e.message));
