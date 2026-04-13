import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"
dotenv.config()

async function test() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const prompt = `You are a Smart Meal Assistant. The current window is Lunch with a limit of 40 points. 
Available items in city: [{"id":"1","name":"Thali","price":40}].
Select a combination of 1 or 2 items that use as close to 40 points as possible without exceeding it. 
Return ONLY JSON format like this:
{
  "items": [{"name": "Item 1", "price": 10}],
  "totalPoints": 10,
  "explanation": "This combo uses x/y points to minimize your loss to the Admin sweep."
}
No markdown formatting, just raw JSON.`;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        console.log("Raw Response:");
        console.log(text);
        
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);
        console.log("Parsed Data:", data);
    } catch (error) {
        console.error("Test Error:", error);
    }
}
test();
