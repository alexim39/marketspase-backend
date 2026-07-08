import OpenAI from 'openai';

let openai = null;
function getClient() {
  if (!openai && process.env.DEEPSEEK_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
  }
  return openai;
}

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export async function scoreCommentQuality(comment, postContent = '') {
  const client = getClient();
  if (!client) return 0.5;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{
        role: 'system',
        content: `You are a comment quality scorer. Score comments on a 0-1 scale based on:
- Relevance to the post (does it engage with the content?)
- Specificity (is it specific, not generic like "Nice post"?)
- Value (does it add value — ask a question, share insight, give feedback?)
- Authenticity (does it sound human, not bot-like?)

Return ONLY a JSON object: { "score": 0.0-1.0, "reason": "brief explanation" }`
      }, {
        role: 'user',
        content: `Post: "${postContent.substring(0, 200)}"\n\nComment: "${comment}"`
      }],
      temperature: 0,
      max_tokens: 100
    });

    const text = response.choices[0]?.message?.content?.trim() || '{"score":0.5}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Math.min(1, Math.max(0, parsed.score || 0.5));
  } catch (e) {
    return 0.5; // Default score on error
  }
}

export async function generateDailySuggestions(marketerData) {
  const client = getClient();
  if (!client) return ['Post about your best-selling product today', 'Check your campaign performance', 'Engage with your community feed'];

  try {
    const { storeName, category, totalSales, totalViews, recentPosts, activeCampaigns } = marketerData;

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{
        role: 'system',
        content: `You are a business growth assistant for MarketSpase, a Nigerian commerce platform. Generate 3 actionable, specific daily suggestions for a business owner. Suggestions should be:
1. Concrete and actionable (not vague advice)
2. Relevant to their store category
3. Helping them grow sales, engagement, or visibility on the platform
4. Written in a friendly, motivational tone
5. Each suggestion should be 1-2 sentences

Return ONLY a JSON array of strings: ["suggestion 1", "suggestion 2", "suggestion 3"]`
      }, {
        role: 'user',
        content: `Generate 3 daily suggestions for:
Store: ${storeName || 'My Store'}
Category: ${category || 'General'}
Total sales: ${totalSales || 0}
Total views: ${totalViews || 0}
Active campaigns: ${activeCampaigns || 0}
Recent posts: ${recentPosts || 0}`
      }],
      temperature: 0.7,
      max_tokens: 300
    });

    const text = response.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch (e) {
    return [];
  }
}
