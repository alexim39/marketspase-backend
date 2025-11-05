
export const calculateSimilarity = (str1, str2) => {
  /**
   * Calculate similarity between two strings (0-1)
   */
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  /**
   * Calculate Levenshtein distance between two strings
   */
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i-1) === str1.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};


export const isNameComponentMatch = (part1, part2) => {
  /**
   * Check if two name components match, with flexibility for:
   * - Exact match
   * - Contains match (one contains the other)
   * - Initial match
   * - Common variations
   */
  
  // Exact match
  if (part1 === part2) return true;
  
  // One contains the other (useful for full name vs abbreviated)
  if (part1.includes(part2) || part2.includes(part1)) return true;
  
  // Initial match (J vs John, M vs Michael)
  if (part1.length === 1 && part2.startsWith(part1)) return true;
  if (part2.length === 1 && part1.startsWith(part2)) return true;
  
  // Common name variations dictionary
  const nameVariations = {
    'john': ['jon', 'johnny', 'jonathan'],
    'michael': ['mike', 'mikey', 'mich'],
    'robert': ['rob', 'bob', 'roberto'],
    'richard': ['rick', 'dick', 'rich'],
    'william': ['will', 'bill', 'billy'],
    'jennifer': ['jen', 'jenn', 'jenny'],
    'elizabeth': ['liz', 'beth', 'liza', 'eliza'],
    'katherine': ['kate', 'katie', 'catherine', 'cat'],
    'christopher': ['chris', 'topher'],
    'matthew': ['matt', 'mat'],
    'joseph': ['joe', 'joey'],
    'daniel': ['dan', 'danny'],
    'anthony': ['tony', 'ant'],
    'samuel': ['sam', 'sammie'],
    'andrew': ['andy', 'drew'],
    'theodore': ['ted', 'teddy', 'theo'],
    'nicholas': ['nick', 'nico'],
    'alexander': ['alex', 'xander'],
    'benjamin': ['ben', 'benny'],
    'jonathan': ['jon', 'john', 'nathan']
  };
  
  // Check variations
  const variations1 = nameVariations[part1] || [];
  const variations2 = nameVariations[part2] || [];
  
  if (variations1.includes(part2) || variations2.includes(part1)) return true;
  
  // Levenshtein distance for similar names (typo tolerance)
  if (calculateSimilarity(part1, part2) > 0.8) return true;
  
  return false;
};