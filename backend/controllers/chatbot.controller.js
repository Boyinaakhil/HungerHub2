import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize genAI inside the controller to avoid crashing on startup if key is missing
let genAI;

const systemPrompt = `You are "The Hunger Bot", a friendly and helpful support assistant for HungerHub.
HungerHub uses a point-based system:
- Leave deduction: If a user applies for leave, they lose points. Explain the daily sweep and point usage carefully.
- Daily sweeps: There is a daily sweep logic where points/money might be deducted (e.g. ₹30 deducted last night). Explain that this is due to the daily sweep meant to reset or maintain system points.
- Timing: Dinner points cannot be used for lunch. The timings are strict: 10AM-3PM for lunch processing, etc.

Be concise, polite, and helpful. Always refer to yourself as The Hunger Bot. Provide natural language answers to user queries regarding points, timings, and deductions.`;

export const handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({ 
                reply: "Sorry, my brain is offline right now (Missing GEMINI_API_KEY). Please add it to your environment variables!" 
            });
        }

        if (!genAI) {
            genAI = new GoogleGenerativeAI(apiKey);
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            systemInstruction: systemPrompt 
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ reply: text });
    } catch (error) {
        console.error("Chatbot Error:", error);
        return res.status(500).json({ reply: "Sorry, I'm having trouble processing your request right now." });
    }
};

export const handleSmartMeal = async (req, res) => {
    try {
        const { windowName, windowLimit, items } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(403).json({ error: "Missing GEMINI_API_KEY" });
        }

        if (!genAI) {
            genAI = new GoogleGenerativeAI(apiKey);
        }

        const prompt = `You are a Smart Meal Assistant. The current window is ${windowName} with a limit of ${windowLimit} points. 
Available items in city: ${JSON.stringify(items)}.
Select a combination of 1 or 2 items that use as close to ${windowLimit} points as possible without exceeding it. 
Return ONLY JSON format like this:
{
  "items": [{"name": "Item 1", "price": 10}],
  "totalPoints": 10,
  "explanation": "This combo uses x/y points to minimize your loss to the Admin sweep."
}
No markdown formatting, just raw JSON.`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
             text = text.substring(jsonStart, jsonEnd + 1);
        }
        const data = JSON.parse(text);

        return res.status(200).json(data);
    } catch (error) {
        import("fs").then(fs => fs.writeFileSync("chatbot-error.txt", error.stack || error.toString()));
        console.error("Smart Meal Error:", error);
        return res.status(500).json({ error: "Failed to generate AI suggestion." });
    }
};
