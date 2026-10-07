import logging
from typing import Optional
from app.core.config import settings
from app.models.schemas import HackathonIdea

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self.client = None
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key and self.api_key != "your-gemini-api-key":
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Initialized Google GenAI Client successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI Client: {e}")
        else:
            logger.warning("GEMINI_API_KEY is not set or using placeholder. Running Gemini service in mock mode.")

    def is_configured(self) -> bool:
        return self.client is not None

    async def generate_chat(self, message: str, system_instruction: Optional[str] = None) -> dict:
        if not self.client:
            return {
                "reply": f"[MOCK GEMINI RESPONSE] Received: '{message}'. To enable live Gemini AI responses, provide your GEMINI_API_KEY in backend/.env.",
                "model": "mock-gemini-preview",
                "is_mock": True
            }

        try:
            from google.genai import types
            
            # Using interactions API or models.generate_content API
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            ) if system_instruction else None

            # Attempt generate_content with primary or fallback model
            model_name = settings.GEMINI_MODEL
            response = self.client.models.generate_content(
                model=model_name,
                contents=message,
                config=config
            )
            return {
                "reply": response.text,
                "model": model_name,
                "is_mock": False
            }
        except Exception as e:
            logger.error(f"Gemini API generation error: {e}")
            # Try interaction API if generate_content has specific flags
            try:
                interaction = self.client.interactions.create(
                    model="gemini-3.8-flash",
                    input=message
                )
                return {
                    "reply": interaction.output_text or str(interaction),
                    "model": "gemini-3.8-flash",
                    "is_mock": False
                }
            except Exception as e2:
                logger.error(f"Fallback interactions call error: {e2}")
                return {
                    "reply": f"Gemini API Error: {str(e)}",
                    "model": settings.GEMINI_MODEL,
                    "is_mock": False
                }

    async def generate_structured_idea(self, topic: str, target_audience: Optional[str] = None) -> HackathonIdea:
        if not self.client:
            return HackathonIdea(
                title=f"Smart {topic.capitalize()} Hub",
                tagline=f"Empowering {target_audience or 'users'} with real-time intelligent automation.",
                target_users=target_audience or "Developers, organizers, and end users",
                core_features=[
                    "Instant data ingestion with automated categorization",
                    "Predictive assistant with conversational query interface",
                    "Live multi-user collaboration dashboard"
                ],
                suggested_tech_stack=["React", "FastAPI", "Neon Postgres", "Google Gemini", "uv"],
                winning_pitch_hook="Solves manual processing overhead in seconds with reliable, verifiable AI insights."
            )

        try:
            from google.genai import types
            prompt = f"Generate a structured, winning hackathon project idea for the topic '{topic}'"
            if target_audience:
                prompt += f" targeted at {target_audience}."

            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=HackathonIdea,
                )
            )
            return HackathonIdea.model_validate_json(response.text)
        except Exception as e:
            logger.error(f"Structured idea generation failed: {e}. Falling back to default format.")
            return HackathonIdea(
                title=f"AI-Powered {topic.title()}",
                tagline="Fast, intelligent hackathon prototype.",
                target_users=target_audience or "General audience",
                core_features=["Real-time processing", "Intelligent summarization", "Fast reactive UI"],
                suggested_tech_stack=["React", "FastAPI", "Neon", "Gemini"],
                winning_pitch_hook="High-impact minimum viable product built for speed and reliability."
            )

gemini_service = GeminiService()
