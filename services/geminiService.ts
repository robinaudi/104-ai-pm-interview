
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Candidate, ScoringStandard } from "../types";
import { fetchScoringStandards } from "./supabaseService";
import { APP_VERSION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to decode Industry Rule stored as JSON
const formatIndustryRule = (standard: ScoringStandard): string => {
    if (standard.category !== 'INDUSTRY_PENALTY') return standard.rule_text;
    
    // Check if rule_text looks like JSON
    try {
        const config = JSON.parse(standard.rule_text);
        // It's a structured penalty. Format it for AI.
        // Example: {"competency": 0.7, "culture": 0.6}
        const industry = standard.condition;
        const penalties = Object.entries(config)
            .map(([key, val]) => {
                const displayKey = key === 'competency' ? 'Skills Match' : key.charAt(0).toUpperCase() + key.slice(1);
                return `${displayKey} x${val}`;
            })
            .join(', ');
        
        return `IF Candidate Industry is "${industry}" -> Apply Multipliers: ${penalties}. \n   CRITICAL: Add "Industry Penalty Applied: ${industry}" to Gap Analysis.`;
    } catch (e) {
        return standard.rule_text;
    }
};

// Construct prompt dynamically from DB Standards
const getSystemInstruction = (language: string, jdContent: string, standards: ScoringStandard[]) => {
    
    const experienceRules = standards
        .filter(s => s.category === 'EXPERIENCE_CEILING' && s.is_active)
        .sort((a, b) => a.priority - b.priority)
        .map(s => `- ${s.rule_text}`)
        .join('\n');

    const industryRules = standards
        .filter(s => s.category === 'INDUSTRY_PENALTY' && s.is_active)
        .sort((a, b) => a.priority - b.priority)
        .map(s => `- ${formatIndustryRule(s)}`)
        .join('\n');

    const generalRules = standards
        .filter(s => s.category === 'GENERAL_RULE' && s.is_active)
        .sort((a, b) => a.priority - b.priority)
        .map(s => `- ${s.rule_text}`)
        .join('\n');

    // NEW: V3 DYNAMIC DIMENSIONS
    const dimensionRules = standards
        .filter(s => s.category === 'DIMENSION_WEIGHT' && s.is_active)
        .sort((a, b) => a.priority - b.priority)
        .map(s => {
            return `   - **${s.condition}** (Weight: ${s.rule_text}%): ${s.description || 'Rate 0-10'}`;
        })
        .join('\n');

    return `
You are Robin Hsu, VP of a leading SaaS company. You are known for being EXTREMELY STRICT, REALISTIC, and DATA-DRIVEN.
You despise grade inflation. 

*** 1. SCORING MATRIX (THE CORE - 100 POINTS) ***
You must evaluate the candidate based on the following Weighted Dimensions. 
Scores are 0-10. Weighted Sum is the Final Match Score.

${dimensionRules || '- No dimensions configured. Use general judgement.'}

*** 2. EXPERIENCE CEILING (Baseline) ***
First, calculate "Effective Relevant Years" by applying discounts:
${generalRules || '- No specific discount rules.'}
Then apply ceilings:
${experienceRules || '- No specific experience ceilings defined.'}

*** 3. INDUSTRY PENALTY ***
${industryRules || '- No specific industry penalties defined.'}

*** 4. ACTIVE APPLICANT DETECTION ***
Check if the resume text explicitly mentions **"主動應徵"**, **"Active Application"**, or similar phrases in the header or objective section.
- If found -> Set "isUnsolicited" to TRUE.
- If not found -> Set "isUnsolicited" to FALSE.

*** JOB DESCRIPTION ***
${jdContent}
***********************

### OUTPUT STYLE (NO FLUFF) ###
- **Summary**: ONE sentence.
- **HR Advice**: 3 Bullet points ONLY.
  1. Verdict: STRICTLY USE "Proceed to Interview" OR "Reject".
  2. Key Risk: **If Industry Penalty OR Low Skill Relevance applied, explicitly state why.**
  3. Key Strength.
- **Language**: ${language}.

### DATA EXTRACTION ###
- **English Name**: Extract accurately. If mixed with Chinese (e.g. "陳小明 (David)"), extract "David".

You must output strictly in JSON format matching the schema.
`;
};

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
        isUnsolicited: { type: Type.BOOLEAN },
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
    matchScore: { type: Type.NUMBER, description: "Final weighted score 0-10" },
    // NEW: Dynamic Map for Scoring Dimensions
    scoringDimensions: {
        type: Type.OBJECT,
        description: "Key-Value pair of Dimension Name and Score (0-10). Must match the dimensions provided in system instructions.",
        properties: {}, // Allow dynamic keys
    },
    gapAnalysis: {
        type: Type.OBJECT,
        properties: {
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["pros", "cons"]
    },
    fiveForces: {
      type: Type.OBJECT,
      properties: {
        skillsMatch: { type: Type.NUMBER },
        experience: { type: Type.NUMBER },
        cultureFit: { type: Type.NUMBER },
        potential: { type: Type.NUMBER },
        communication: { type: Type.NUMBER },
      },
      required: ["skillsMatch", "experience", "cultureFit", "potential", "communication"]
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

const cleanYearsOfExperience = (input: any): number => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
        const match = input.match(/(\d+(\.\d+)?)/);
        if (match) return parseFloat(match[0]);
    }
    return 0;
};

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
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            for (const chunk of groundingChunks) {
                if (chunk.web?.uri && chunk.web.uri.includes('linkedin.com/in/')) {
                    return chunk.web.uri;
                }
            }
        }
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
  
  // FETCH SCORING STANDARDS
  const standards = await fetchScoringStandards();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
            { text: `Analyze this resume against the JD. Output JSON in ${language}. Use model version ${APP_VERSION}.` },
            { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      },
      config: {
        systemInstruction: getSystemInstruction(language, effectiveJd, standards),
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    if (!response.text) throw new Error("No response from AI");
    
    const parsed = parseResponse(response.text);

    // LinkedIn Discovery
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
    
    parsed.modelVersion = APP_VERSION;

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
    
    // FETCH SCORING STANDARDS
    const standards = await fetchScoringStandards();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: `RE-EVALUATE this candidate against the JD using STRICT Robin Hsu Scoring (0-10) with SKILL MATCH and EXPERIENCE DISCOUNT logic. Be concise. Use model version ${APP_VERSION}.` },
                    { text: `CANDIDATE DATA:\n${resumeTextRepresentation}` }
                ]
            },
            config: {
                systemInstruction: getSystemInstruction(language, jdContent, standards),
                responseMimeType: "application/json",
                responseSchema: analysisSchema
            }
        });

        if (response.text) {
            const parsed = parseResponse(response.text);
            parsed.modelVersion = APP_VERSION;
            return parsed;
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

    parsed.extractedData.yearsOfExperience = cleanYearsOfExperience(parsed.extractedData.yearsOfExperience);
    parsed.extractedData.relevantYearsOfExperience = cleanYearsOfExperience(parsed.extractedData.relevantYearsOfExperience);
    
    let src = (parsed.extractedData.detectedSource || 'Unknown').trim();
    const lowerSrc = src.toLowerCase();
    
    if (lowerSrc.includes('104')) src = '104 Corp';
    else if (lowerSrc.includes('linkedin')) src = 'LinkedIn';
    else if (lowerSrc.includes('teamdoor')) src = 'Teamdoor';
    else if (lowerSrc.includes('cake')) src = 'CakeResume';
    else if (lowerSrc.includes('resume') || lowerSrc.includes('pdf') || lowerSrc.includes('upload')) src = 'User Upload';
    
    parsed.extractedData.detectedSource = src;

    if (!parsed.extractedData.relevantYearsOfExperience) {
        parsed.extractedData.relevantYearsOfExperience = parsed.extractedData.yearsOfExperience;
    }

    if (!parsed.extractedData.otherSkills) parsed.extractedData.otherSkills = [];
    if (!parsed.gapAnalysis) parsed.gapAnalysis = { pros: [], cons: [] };
    
    if (parsed.matchScore > 10) parsed.matchScore = parsed.matchScore / 10;
    
    if (parsed.fiveForces) {
        Object.keys(parsed.fiveForces).forEach(k => {
            const key = k as keyof typeof parsed.fiveForces;
            if (parsed.fiveForces[key] > 10) parsed.fiveForces[key] = parsed.fiveForces[key] / 10;
        });
    }
    
    // Sanitize scoringDimensions if present
    if (parsed.scoringDimensions) {
         Object.keys(parsed.scoringDimensions).forEach(k => {
            if (parsed.scoringDimensions![k] > 10) parsed.scoringDimensions![k] = parsed.scoringDimensions![k] / 10;
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
