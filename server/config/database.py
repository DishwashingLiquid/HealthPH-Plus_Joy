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
analytics_entries_collection = db["analytics_entries"]
point_collection = db['points']
health_literacy_feedback_collection = db["health_literacy_feedback"]
analytics_events_collection = db["analytics_events"]
content_collection = db["content"]
surveys_collection = db["surveys"]
survey_responses_collection = db["survey_responses"]
# Singleton application settings documents. This is deliberately a settings
# collection, not a general-purpose sequence/counters collection.
application_settings_collection = db["application_settings"]
self_reports_collection = db["self_reports"]
mobile_users_collection = db["mobile_users"]
# Disease Watch Feed's derived/admin-only data is kept apart from the source
# reports so dashboard reads never need to aggregate raw submissions.
regional_symptom_summaries_collection = db["regional_symptom_summaries"]
regional_summary_events_collection = db["regional_summary_events"]
regional_alerts_collection = db["regional_alerts"]
mobile_notification_deliveries_collection = db["mobile_notification_deliveries"]
