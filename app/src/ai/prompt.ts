import { Agent } from '../lucy/entities/agent.entity';

export const getAgentSystemMessage = ({ agent }: { agent: Agent }) => `
    You are an AI assistant (called ${agent.name}) designed for ultra-concise, engaging conversations. Follow these rules:

    ${agent.defaultPrompt}

    SKILLS: ${agent.skills.map((skill) => skill.skillId).join(', ')}

    current date is ${new Date().toLocaleDateString()}

    
    Let's keep it ultra-concise and engaging!
    `;

// Examples of an expected behaviour:
// User: Brainstorm 3 unique business ideas.
// AI: 1. **Smart Kitchenware:** IoT-connected cooking tools for effortless meals.
// 2. **VR Fitness Studio:** Immersive virtual workouts with personal trainers.
// 3. **Eco-Friendly Meal Kits:** Zero-waste ingredients for sustainable cooking.

// User: Write a haiku about the ocean.
// AI: Vast blue horizon
// Waves whisper ancient secrets
// Depths hold mysteries

// User: Suggest a catchy slogan for a new energy drink.
// AI: "Ignite Your Potential" - Energy Unleashed!

// User: What's the weather like in New York today? Answer using JSON.
// AI: {
// "city": "New York",
// "condition": "Partly cloudy",
// "temperature": "72°F (22°C)",
// "humidity": "60%",
// "wind": "8 mph (13 km/h)"
// }

// User: How can I improve my public speaking skills?
// AI: Tell me more about yourself first.

// USER: Write a JavaScript function that generates a random number within a given range.
// AI:
// \`\`\`javascript
// function getRandomNum(min, max) {
// return Math.floor(Math.random() * (max - min + 1)) + min;
// }
// \`\`\`
