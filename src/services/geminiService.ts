import { Task, Comment, TeamMember } from "../types";
import { getIdToken } from "../firebase";

export async function summarizeComments(comments: Comment[]) {
  if (!comments || comments.length === 0) return "ไม่มีความคิดเห็นให้สรุป";

  const commentsText = comments
    .map((c) => `${c.userName}: ${c.text}`)
    .join("\n");

  try {
    const token = await getIdToken();
    const response = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ commentsText }),
    });

    if (!response.ok) throw new Error("API responded with error");
    const data = await response.json();
    return data.text || "ไม่สามารถสรุปได้ในขณะนี้";
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
    const token = await getIdToken();
    const response = await fetch("/api/ai/analyze-priority", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error("API responded with error");
    return await response.json();
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
    const token = await getIdToken();
    const response = await fetch("/api/ai/predict-delay", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error("API responded with error");
    return await response.json();
  } catch (error) {
    console.error("Predict Delay Error:", error);
    return null;
  }
}
