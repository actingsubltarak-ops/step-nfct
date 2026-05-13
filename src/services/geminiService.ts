import { Task, Comment, TeamMember } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini on the frontend as per AI Studio guidelines
// process.env.GEMINI_API_KEY is automatically handled by the platform
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key" });

const MODELS = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview"
};

export async function summarizeComments(comments: Comment[]) {
  if (!comments || comments.length === 0) return "ไม่มีความคิดเห็นให้สรุป";

  const commentsText = comments
    .map((c) => `${c.userName}: ${c.text}`)
    .join("\n");

  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: `สรุปเนื้อหาการพูดคุยต่อไปนี้ให้สั้น กระชับ และได้ใจความสำคัญสำหรับผู้บริหาร (ภาษาไทย):\n\n${commentsText}`,
      config: {
        systemInstruction: "คุณคือผู้ช่วยบริหารที่เก่งในการสรุปประเด็นสำคัญจากการสนทนาในทีมงาน",
      }
    });
    
    return response.text || "ไม่สามารถสรุปได้ในขณะนี้";
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    return "เกิดข้อผิดพลาดในการสรุปเนื้อหา";
  }
}

export async function analyzeTaskPriorityAndTags(task: Partial<Task>) {
  const prompt = `วิเคราะห์งานต่อไปนี้:
ชื่อโครงการ: ${task.project}
ชื่องาน: ${task.title}
รายละเอียด: ${task.description}
วันเริ่ม: ${task.startDate}
วันสิ้นสุด: ${task.endDate}

ช่วยแนะนำ:
1. ระดับความสำคัญ (Priority): Low, Medium, High, Urgent พร้อมเหตุผลสั้นๆ
2. แท็ก (Tags): แนะนำ 3-5 แท็กที่เกี่ยวข้องกับเนื้อหางาน
3. หมวดหมู่ (Category): หมวดหมู่ที่เหมาะสมที่สุดสำหรับงานนี้`;

  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction: "คุณคือผู้เชี่ยวชาญด้านการบริหารจัดการโครงการ (Project Management Expert) ที่ช่วยวิเคราะห์และจัดลำดับความสำคัญของงาน",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: { type: Type.STRING },
            reason: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            category: { type: Type.STRING }
          },
          required: ["priority", "reason", "tags", "category"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}

export async function predictProjectDelay(task: Task, teamMember: TeamMember | undefined) {
  const prompt = `
    วิเคราะห์ความเสี่ยงในการล่าช้าของงาน (Delay Probability Prediction)
    
    ข้อมูลงาน:
    - ชื่อ: ${task.title}
    - รายละเอียด: ${task.description}
    - กำหนดส่ง: ${task.endDate}
    - สถานะปัจจุบัน: ${task.status}
    - จำนวนงานย่อย: ${task.subtasks?.length || 0}
    - จำนวนงานย่อยที่เสร็จ: ${task.subtasks?.filter((s: any) => s.completed).length || 0}
    
    ข้อมูลผู้รับผิดชอบ:
    - ชื่อ: ${teamMember?.name}
    - ตำแหน่ง: ${teamMember?.role}
    
    กรุณาประเมินความน่าจะเป็นที่จะล่าช้า (0-100%) และให้เหตุผลสั้นๆ
    ตอบกลับในรูปแบบ JSON:
    {
      "probability": number,
      "reason": "string"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            probability: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["probability", "reason"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Predict Delay Error:", error);
    return null;
  }
}

export async function generateGenericInsight(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: {
        systemInstruction: "คุณคือผู้เชี่ยวชาญด้านการบริหารจัดการโครงการ (Project Management Expert) ที่ช่วยวิเคราะห์ข้อมูลระดับองค์กร"
      }
    });
    return response.text || "ไม่สามารถสร้างข้อมูลเชิงลึกได้ในขณะนี้";
  } catch (error: any) {
    console.error("Generic AI Error:", error);
    throw error;
  }
}
