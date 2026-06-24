import urllib.request
import urllib.error
import json
import asyncio

class UserMessage:
    def __init__(self, text: str):
        self.text = text

class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "anthropic"
        self.model_name = "claude-3-5-sonnet-20241022"

    def with_model(self, provider: str, model_name: str):
        self.provider = provider
        self.model_name = model_name
        return self

    async def send_message(self, message: UserMessage) -> str:
        print(f"[LlmChat] Session {self.session_id} - Model: {self.provider}/{self.model_name}")
        
        # If API key is empty, mock_key, or placeholder, fall back to mock response
        if not self.api_key or self.api_key in ("mock_key", "your-emergent-llm-key", ""):
            print("[LlmChat] Using local mock response (API key not configured)")
            return "Hello! I am LUMI, your AI intake specialist. (This is a local mock response because the platform's proprietary SDK is running locally)."

        # Call Anthropic API if provider matches
        if self.provider == "anthropic" or "claude" in self.model_name.lower():
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            data = {
                "model": "claude-3-5-sonnet-20241022" if "claude" in self.model_name.lower() else self.model_name,
                "max_tokens": 4000,
                "system": self.system_message,
                "messages": [
                    {
                        "role": "user",
                        "content": message.text
                    }
                ]
            }
            
            req = urllib.request.Request(
                url, 
                data=json.dumps(data).encode("utf-8"), 
                headers=headers, 
                method="POST"
            )
            
            try:
                # Run the blocking request in a thread pool to avoid blocking the event loop
                def do_request():
                    with urllib.request.urlopen(req, timeout=30) as response:
                        return response.read().decode("utf-8")
                
                res_body = await asyncio.to_thread(do_request)
                res_json = json.loads(res_body)
                reply = res_json["content"][0]["text"]
                return reply
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8")
                print(f"[LlmChat ERROR] Anthropic API failed (HTTP {e.code}): {err_body}")
                raise Exception(f"Anthropic API Error (HTTP {e.code}): {err_body}")
            except Exception as e:
                print(f"[LlmChat ERROR] Request failed: {e}")
                raise e
        else:
            return "Mock response: Provider not supported for live chat yet."
