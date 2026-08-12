from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import dotenv_values
import os
import certifi

# Get configuration values from .env file
config = dotenv_values()

# MONGODB URI CONNECTION
uri = os.getenv("MONGO_URI")

# Create a new client and connect to the server
# client = MongoClient(uri, server_api=ServerApi("1"), tlsCAFile=ca)
client = MongoClient(uri, server_api=ServerApi("1"))

# Send a ping to confirm a successful connection
try:
    client.admin.command("ping")
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

# Database Name
db = client[os.getenv("DB_NAME")]

# Tables / Collections
user_collection = db['users']
organization_collection = db["organizations"]
role_label_collection = db["role_labels"]
activity_logs_collection = db['activity_logs']
dataset_collection = db["datasets"]
point_collection = db['points']
health_literacy_analytics_events_collection = db["health_literacy_analytics_events"]
health_literacy_feedback_collection = db["health_literacy_feedback"]
health_literacy_content_collection = db["health_literacy_content"]
sentiment_pulse_surveys_collection = db["sentiment_pulse_surveys"]
sentiment_pulse_survey_responses_collection = db["sentiment_pulse_survey_responses"]
self_reports_collection = db["self_reports"]
mobile_users_collection = db["mobile_users"]
