import os
from fastapi import FastAPI
from pydantic import BaseModel, Field
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY","")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL","https://api.openai.com/v1")
MODEL = os.getenv("MODEL","gpt-4o-mini")

app = FastAPI()

class GenIn(BaseModel):
    requirement: str = Field(min_length=10)

@app.get('/healthz')
def healthz():
    return {"ok": True}

@app.post('/generate/testcases')
async def generate_testcases(body: GenIn):
    print("[LLM] got request:", body.requirement[:60])
    prompt = f"""You are a senior SDET. Generate a concise list of atomic test cases
for the following requirement. Focus on inputs, expected outputs, and edge cases.
Return 6-10 bullet points.
Requirement:
{body.requirement}
"""
    if not OPENAI_API_KEY:
        return {"testcases": [
            "Verify valid email triggers password reset link.",
            "Reject unregistered email with generic success message (no enumeration).",
            "Expired token shows invalid/expired message.",
            "Single-use link; second use shows already-used message.",
            "Enforce password policy and show helpful errors.",
            "Unicode emails supported; ensure normalization.",
            "This is the extra bullet."
        ]}
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers=headers,
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": "You are a helpful senior SDET."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2
            }
        )
        r.raise_for_status()
        data = r.json()
        text = data.get("choices",[{}])[0].get("message",{}).get("content","")
        bullets = [line.strip("-• ").strip() for line in text.splitlines() if line.strip()]
        bullets = [b for b in bullets if len(b) > 3][:10]
        return {"testcases": bullets or ["No output parsed. Check provider response."]}
