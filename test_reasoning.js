const OpenAI = require("openai");

async function testReasoning() {
    const openai = new OpenAI({
        apiKey: "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",
        baseURL: "https://openrouter.ai/api/v1",
    });

    const models = ["stepfun/step-3.5-flash:free", "google/gemini-2.0-flash-001"];
    
    for (const model of models) {
        try {
            console.log(`Testing model: ${model}...`);
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: "How many r's are in the word 'strawberry'?" }],
                extra_body: {
                    reasoning: { enabled: true }
                }
            });

            console.log("Model:", model);
            console.log("Answer:", completion.choices[0].message.content);
            console.log("Reasoning Tokens Used:", completion.usage.reasoning_tokens);
            return; // Success
        } catch (e) {
            console.error(`Error with ${model}:`, e.message);
        }
    }
}

testReasoning();