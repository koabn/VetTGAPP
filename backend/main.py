from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене замените на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None

class SubmitData(BaseModel):
    user: TelegramUser

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Telegram Mini App Backend is running"}

@app.post("/api/submit")
async def submit_data(data: SubmitData):
    try:
        # Здесь будет ваша логика обработки данных
        # Например, сохранение в базу данных
        return {
            "status": "success",
            "message": f"Данные получены от пользователя {data.user.first_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True) 