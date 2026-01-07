
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Candidate } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Dynamic instruction generator
const getSystemInstruction = (language: string, jdContent: string) => `
You are Robin Hsu, VP of a leading SaaS company. You are known for being EXTREMELY STRICT, REALISTIC, and DATA-DRIVEN.
You despise grade inflation. 

*** 1. THE ROBIN HSU SCORING STANDARD (BASE CEILING) ***
First, determine the base score range based on years of experience:
- Score 10.0 : 20+ Years. (VP/Director Level).
- Score 8.0 - 9.9 : 10-15 Years. (Dept Manager Level).
- Score 6.0 - 7.9 : 6-10 Years. (Senior / Team Lead). -> **CRITICAL: A 6-year candidate MAX score is ~7.5.**
- Score 3.0 - 5.9 : 3-5 Years. (Mid-level Executor).
- Score 1.0 - 2.9 : 0-2 Years. (Junior / Entry).

*** 2. INDUSTRY PENALTY (THE "TRADITIONAL SECTOR" TAX) ***
**CRITICAL RULE:** E-commerce/SaaS requires speed and agility. Candidates from bureaucratic industries often fail to adapt.
Check the candidate's **Current or Primary Industry**. If they come from:
- **Financial Holdings / Banks / FinTech** (金控, 銀行, 國泰, 富邦, 中信, 玉山...)
- **Telecom** (電信, 中華電信, 遠傳, 台哥大...)
- **Government / Public Sector** (政府機關, 公家單位)
- **Research Institutes / Foundations** (資策會, 工研院, 財團法人, 協會)

You MUST apply the following **DISCOUNT MULTIPLIERS** to their 5-Forces and Match Score. **DO NOT HESITATE.**

- **Competency (競爭力)**: Multiply by **0.7** (Skills are often outdated or strictly process-bound).
- **Culture Fit (文化)**: Multiply by **0.6** (Lack of Agile mindset, used to bureaucracy).
- **Potential (潛力)**: Multiply by **0.6** (Hard to reshape work habits).
- **Communication (溝通)**: Multiply by **0.8** (Used to hierarchical reporting, not flat comms).
- **Experience (經驗)**: Multiply by **0.9** (Years of experience are less relevant to SaaS).

*CALCULATION EXAMPLE*:
A candidate from "Cathay Financial (國泰金控)" with 6 years exp might start at Base 7.0.
- Apply Culture Fit 0.6x -> 4.2.
- Apply Competency 0.7x -> 4.9.
- **FINAL MATCH SCORE** should be significantly reduced (e.g., from 7.0 -> 5.5).

*** JOB DESCRIPTION ***
${jdContent}
***********************

### OUTPUT STYLE (NO FLUFF) ###
- **Summary**: ONE sentence.
- **HR Advice**: 3 Bullet points ONLY.
  1. Verdict: STRICTLY USE "Proceed to Interview" OR "Reject".
  2. Key Risk: **If Industry Penalty applied, explicitly state: "Score discounted due to Traditional Industry background (High bureaucracy, low agility)."**
  3. Key Strength.
- **Language**: ${language}.

### DATA EXTRACTION ###
- **English Name**: Extract accurately. If mixed with Chinese (e.g. "陳小明 (David)"), extract "David".

You must output strictly in JSON format matching the schema.
`;

// Schema for structured output
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    extractedData: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        englishName: { type: Type.STRING },
        email: { type: Type.STRING },
        currentPosition: { type: Type.STRING },
        yearsOfExperience: { type: Type.NUMBER },
        relevantYearsOfExperience: { type: Type.NUMBER },
        detectedSource: { type: Type.STRING },
        linkedinUrl: { type: Type.STRING },
        personalInfo: {
            type: Type.OBJECT,
            properties: {
                mobile: { type: Type.STRING },
                gender: { type: Type.STRING },
                age: { type: Type.STRING },
                address: { type: Type.STRING },
                highestEducation: { type: Type.STRING },
                school: { type: Type.STRING },
                major: { type: Type.STRING },
                marriage: { type: Type.STRING }
            },
            required: ["mobile", "gender", "age", "address", "highestEducation", "school", "major"]
        },
        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
        otherSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        autobiography: { type: Type.STRING },
        certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        portfolio: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, url: { type: Type.STRING } }
            }
        },
        workExperience: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    company: { type: Type.STRING },
                    title: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    description: { type: Type.STRING },
                    isRelevant: { type: Type.BOOLEAN }
                }
            }
        }
      },
      required: ["name", "email", "yearsOfExperience", "relevantYearsOfExperience", "personalInfo", "workExperience"]
    },
    summary: { type: Type.STRING },
    matchScore: { type: Type.NUMBER, description: "Score 0-10 based on Experience Ceiling AND Industry Penalty" },
    gapAnalysis: {
        type: Type.OBJECT,
        properties: {
            pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 3 Pros" },
            cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 3 Cons" }
        },
        required: ["pros", "cons"]
    },
    fiveForces: {
      type: Type.OBJECT,
      properties: {
        competency: { type: Type.NUMBER },
        experience: { type: Type.NUMBER },
        cultureFit: { type: Type.NUMBER },
        potential: { type: Type.NUMBER },
        communication: { type: Type.NUMBER },
      },
      required: ["competency", "experience", "cultureFit", "potential", "communication"]
    },
    swot: {
      type: Type.OBJECT,
      properties: {
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
        opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
        threats: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["strengths", "weaknesses", "opportunities", "threats"]
    },
    hrAdvice: { type: Type.STRING },
    interviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["extractedData", "matchScore", "gapAnalysis", "summary", "fiveForces", "swot", "hrAdvice", "interviewQuestions"]
};

// Helper to strictly parse years
const cleanYearsOfExperience = (input: any): number => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
        const match = input.match(/(\d+(\.\d+)?)/);
        if (match) return parseFloat(match[0]);
    }
    return 0;
};

// Secondary Step: Use Google Search to find LinkedIn if missing
const findLinkedInUrl = async (name: string, email: string, company: string): Promise<string | null> => {
    try {
        const query = `site:linkedin.com/in/ ${email} OR "${name}"`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Find the LinkedIn profile URL for: Name: ${name}, Email: ${email}, Company: ${company}. Search Query: ${query}. Return ONLY the URL string. If not found, return "null".`,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        // Extract URL from grounding chunks (most reliable)
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            for (const chunk of groundingChunks) {
                if (chunk.web?.uri && chunk.web.uri.includes('linkedin.com/in/')) {
                    return chunk.web.uri;
                }
            }
        }

        // Fallback: Check text text
        const text = response.text || '';
        const urlMatch = text.match(/https:\/\/www\.linkedin\.com\/in\/[\w-]+/);
        return urlMatch ? urlMatch[0] : null;

    } catch (e) {
        console.warn("Smart LinkedIn Search failed:", e);
        return null;
    }
};

// Main Analysis Function
export const analyzeResume = async (base64Data: string, mimeType: string, jobRole: string = "General Role", language: string = "Traditional Chinese", jdContent: string = ""): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("Gemini API Key is missing.");

  const effectiveJd = jdContent || `Target Role: ${jobRole}`;

  try {
    // 1. First Pass: Strict PDF Parsing
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
            { text: `Analyze this resume against the JD. Output JSON in ${language}.` },
            { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      },
      config: {
        systemInstruction: getSystemInstruction(language, effectiveJd),
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    if (!response.text) throw new Error("No response from AI");
    
    const parsed = parseResponse(response.text);

    // 2. Second Pass: Smart LinkedIn Discovery (if missing)
    const currentUrl = parsed.extractedData.linkedinUrl?.toLowerCase();
    const isInvalid = !currentUrl || currentUrl === 'n/a' || currentUrl === 'null' || !currentUrl.includes('linkedin.com');

    if (isInvalid) {
        const { name, email, currentPosition } = parsed.extractedData;
        if (email && email !== 'Unknown') {
             const foundUrl = await findLinkedInUrl(name, email, currentPosition);
             if (foundUrl) {
                 parsed.extractedData.linkedinUrl = foundUrl;
                 parsed.extractedData.detectedSource = "LinkedIn (AI Discovered)";
             }
        }
    }

    return parsed;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

// Re-evaluate Candidate
export const reEvaluateCandidate = async (candidate: Candidate, jdContent: string, language: string = "Traditional Chinese"): Promise<AnalysisResult> => {
    if (!process.env.API_KEY) throw new Error("Gemini API Key is missing.");
    if (!candidate.analysis) throw new Error("Candidate has no existing data to re-evaluate.");

    const resumeTextRepresentation = JSON.stringify(candidate.analysis.extractedData, null, 2);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: `RE-EVALUATE this candidate against the JD using STRICT Robin Hsu Scoring (0-10). Be concise.` },
                    { text: `CANDIDATE DATA:\n${resumeTextRepresentation}` }
                ]
            },
            config: {
                systemInstruction: getSystemInstruction(language, jdContent),
                responseMimeType: "application/json",
                responseSchema: analysisSchema
            }
        });

        if (response.text) {
            return parseResponse(response.text);
        } else {
            throw new Error("No response from AI");
        }
    } catch (error) {
        console.error("Re-Evaluation Error:", error);
        throw error;
    }
};

const parseResponse = (text: string): AnalysisResult => {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
    }
    
    const parsed = JSON.parse(cleanText) as AnalysisResult;

    // SAFETY CHECKS & NORMALIZATION
    parsed.extractedData.yearsOfExperience = cleanYearsOfExperience(parsed.extractedData.yearsOfExperience);
    parsed.extractedData.relevantYearsOfExperience = cleanYearsOfExperience(parsed.extractedData.relevantYearsOfExperience);
    
    // Fallback if AI forgot to generate relevantYears
    if (!parsed.extractedData.relevantYearsOfExperience) {
        parsed.extractedData.relevantYearsOfExperience = parsed.extractedData.yearsOfExperience;
    }

    if (!parsed.extractedData.detectedSource) parsed.extractedData.detectedSource = 'Unknown';
    if (!parsed.extractedData.otherSkills) parsed.extractedData.otherSkills = [];
    if (!parsed.gapAnalysis) parsed.gapAnalysis = { pros: [], cons: [] };
    
    // FORCE SCORE TO 0-10 RANGE
    if (parsed.matchScore > 10) parsed.matchScore = parsed.matchScore / 10;
    
    // Ensure all 5 forces are 0-10
    if (parsed.fiveForces) {
        Object.keys(parsed.fiveForces).forEach(k => {
            const key = k as keyof typeof parsed.fiveForces;
            if (parsed.fiveForces[key] > 10) parsed.fiveForces[key] = parsed.fiveForces[key] / 10;
        });
    }

    return parsed;
};

export const chatWithGemini = async (history: {role: string, parts: {text: string}[]}[], message: string, languageInstruction: string = "Traditional Chinese") => {
    if (!process.env.API_KEY) throw new Error("Missing API Key");
    
    const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        history: history,
        config: {
            systemInstruction: `You are a helpful HR assistant. Help the user evaluate candidates based on the specific Job Descriptions defined in the system. Please answer primarily in ${languageInstruction}.`
        }
    });

    const response = await chat.sendMessage({ message });
    return response.text;
};
