import os

import litellm
from configs.settings import settings
from litellm import completion

litellm.drop_params = True
class LLMIntegration:
    """
    This class is responsible for integrating with the LLM (Language Model) service.
    It provides methods to interact with the LLM API and retrieve responses based on user queries.
    """

    def __init__(self, settings):
        self.settings = settings

    def get_llm_key_and_model(self):
        """
        This method retrieves the LLM API key and model from the settings, based on the environment variables.

        :return: A tuple containing the LLM API key and model
        """
        key = None
        model = None
        if self.settings.GROQ_API_KEY and self.settings.GROQ_MODEL:
            key = self.settings.GROQ_API_KEY
            model = f"groq/{self.settings.GROQ_MODEL}"
        elif self.settings.CLAUDE_API_KEY and self.settings.CLAUDE_MODEL:
            key = self.settings.CLAUDE_API_KEY
            model = f"anthropic/{self.settings.CLAUDE_MODEL}"
            os.environ["ANTHROPIC_API_KEY"] = key
        return key, model

    def query_llm(self, messages: list[dict]):
        """
        This method takes a user query as input and interacts with the LLM API to retrieve a response.
        It handles the API request and processes the response accordingly.

        :param messages: A list of message dictionaries to send to the LLM

        :return: The response from the LLM API
        """
        try:
            key, model = self.get_llm_key_and_model()
            response = completion(
                api_key=key,
                model=model,
                messages=messages,
                temperature=0.7,
            )
            return response
        except Exception as e:
            # Handle any exceptions that may occur during the API request
            print(f"Error querying LLM: {e}")
            return None

llm_integration = LLMIntegration(settings)