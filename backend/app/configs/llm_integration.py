from configs.settings import settings
from litellm import completion

import os

os.environ['GROQ_API_KEY'] = settings.GROQ_API_KEY

class LLMIntegration:
    """
    This class is responsible for integrating with the LLM (Language Model) service.
    It provides methods to interact with the LLM API and retrieve responses based on user queries.
    """

    def __init__(self, settings):
        self.settings = settings

    def query_llm(self, messages: list[dict]):
        """
        This method takes a user query as input and interacts with the LLM API to retrieve a response.
        It handles the API request and processes the response accordingly.

        :param messages: A list of message dictionaries to send to the LLM

        :return: The response from the LLM API
        """
        try:
            # Make a request to the LLM API using the provided user query
            response = completion(
                model=f"groq/{self.settings.GROQ_MODEL}",
                messages=messages,
                temperature=0.7,  # Adjust as needed
            )
            return response
        except Exception as e:
            # Handle any exceptions that may occur during the API request
            print(f"Error querying LLM: {e}")
            return None

llm_integration = LLMIntegration(settings)