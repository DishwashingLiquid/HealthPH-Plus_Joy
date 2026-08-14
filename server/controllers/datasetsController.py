from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import time
from numpy import full
import pymongo
from typing_extensions import Annotated
import pandas as pd
import math

from bson import ObjectId
from fastapi import BackgroundTasks, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse

from config.database import user_collection, dataset_collection
from models.user import AdminResult
from middleware.requireAdmin import require_admin
from middleware.requireRole import require_role
from schema.datasetSchema import individual_dataset, list_datasets
from helpers.datasetsHelpers import annotation
from helpers.miscHelpers import get_ph_datetime
from controllers.pointControllers import delete_point, create_points

# Folder to store datasets
datasets_folder = Path("public/datasets")

annotated_datasets_folder = Path("public/annotated_datasets")

RAW_DATASET_REQUIRED_HEADERS = [
    "id",
    "language",
    "text",
    "location",
    "date_posted",
    "source",
    "date_collected",
]

def normalize_csv_header(header):
    return str(header).strip().lower().replace(" ", "_")

def is_template_dataset(raw_dataset_df):
    if len(raw_dataset_df) != 1:
        return False
    
    first_row = raw_dataset_df.iloc[0].fillna("").astype(str).str.strip()

    return (
        first_row.get("language", "").lower() == "english"
        and first_row.get("text", "") == "Sample post text about lung-related diseases."
        and first_row.get("location", "").lower() == "manila"
        and first_row.get("date_posted", "") == "2026-01-15"
        and first_row.get("source", "") == "Facebook"
        and first_row.get("date_collected", "") == "2026-01-16"
    )

def annotate_dataset(
    dataset_data: dict,
    raw_dataset_filename: str,
    raw_dataset_path: str,
    original_filename: str,
    user_name: str,
):
    print("===== ANNOTATION STARTED =====\n")

    # Split the raw dataset filename [<filename>, 'csv']
    raw_dataset_filename_split = str.split(raw_dataset_filename, sep=".")

    # Append '-annotated' to filename
    result_filename = (
        f"{raw_dataset_filename_split[0]}-annotated.{raw_dataset_filename_split[1]}"
    )

    # Annotated dataset
    # temp comment = needs to stop annotation for a moment 
    #annotated_datasets_path: str = annotation(raw_dataset_filename, result_filename)

    annotated_datasets_path = raw_dataset_path

    file_size = os.stat(annotated_datasets_path).st_size

    num_of_rows = len(pd.read_csv(annotated_datasets_path))

    csv_headers = ["posts", "filtered_location", "annotations"]

    preview_headers = "+".join(csv_headers)

    preview_data = pd.read_csv(
        (annotated_datasets_path),
        nrows=3,
        usecols=csv_headers,
    ).to_json(orient="records")

    to_encode = dict(dataset_data).copy()

    to_encode.update(
        {
            "user_name": user_name,
            "filename": result_filename,
            "original_filename": original_filename,
            "file_size": file_size,
            "num_of_rows": num_of_rows,
            "preview_headers": str(preview_headers),
            "preview_data": json.dumps(preview_data),
            "dataset_type": "ANNOTATED",
            "created_at": get_ph_datetime(),
        }
    )

    new_annotated_dataset = dataset_collection.insert_one(dict(to_encode))

    if not new_annotated_dataset:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload annotated dataset",
        )

    print("DATASET ANNOTATED SUCCESSFULLY")

    create_points(result_filename)
    pass


def run_dataset_processing_job(dataset_id: str):
    dataset_collection.update_one(
        {"_id": ObjectId(dataset_id)},
        {
            "$set": {
                "dataset_status": "PROCESSING",
                "processing_error": "",
                "processed_at": None,
            }
        },
    )

    try:
        raise NotImplementedError("Annotation processer not connected yet.")
    except Exception as error:
        dataset_collection.update_one(
            {"_id": ObjectId(dataset_id)},
            {
                "$set": {
                    "dataset_status": "FAILED",
                    "processing_error": str(error),
                    "processed_at": get_ph_datetime(),
                }
            },
        )


"""
@desc     Upload a single dataset
route     POST api/datasets/upload
@access   Private
"""


async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
):
    # Check if user is an admin or superadmin
    """if not is_admin.result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized to upload a dataset.",
        ) """

    dataset_data = {"user_id": str(current_user["_id"])}

    to_encode = dict(dataset_data).copy()

    # Check if id is valid object ID
    if not ObjectId.is_valid(to_encode["user_id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to upload dataset",
        )

    user_data = user_collection.find_one({"_id": ObjectId(to_encode["user_id"])})

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload dataset",
        )

    # Create uploads destination folder if it not exists
    os.makedirs(datasets_folder, exist_ok=True)

    filename = file.filename

    original_filename = filename

    filename = f"{(round(get_ph_datetime().timestamp() * 1000))}-{filename}"

    file_size = file.size

    content_type = file.content_type

    # Check if file is a csv file
    if content_type != "text/csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type",
        )

    full_path = datasets_folder / filename

    contents = await file.read()

    with open(full_path, "wb") as f:
        f.write(contents)

    try:
        raw_dataset_df = pd.read_csv(full_path, dtype=str, keep_default_na=False)
    except pd.errors.EmptyDataError:
        os.remove(full_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty",
        )
    
    # Check if there is missing headers
    raw_dataset_df.columns = [
        normalize_csv_header(column) for column in raw_dataset_df.columns
    ]

    missing_headers = [
        header
        for header in RAW_DATASET_REQUIRED_HEADERS
        if header not in raw_dataset_df.columns
    ]

    if missing_headers:
        os.remove(full_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing_headers)}",
        )
    
    # remove blank comma rows
    raw_dataset_df = raw_dataset_df.replace(r"^\s*$", pd.NA, regex=True)

    raw_dataset_df = raw_dataset_df.dropna(
        subset=RAW_DATASET_REQUIRED_HEADERS,
        how="all",
    )

    raw_dataset_df = raw_dataset_df.fillna("")

    if raw_dataset_df.empty:
        os.remove(full_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file has no data rows.",
        )

    # Check if uploaded is same as template
    if is_template_dataset(raw_dataset_df):
        os.remove(full_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please replace the sample template row with the real scraped data before uploading.",
        )

    # count rows
    num_of_rows = len(raw_dataset_df)

    # capture languages distribution from uploaded raw dataset
    language_counts = (
        raw_dataset_df["language"]
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .dropna()
        .value_counts()
        .sort_index()
        .to_dict()
    )

    language_counts = {
        str(language): int(count)
        for language, count in language_counts.items()
    }

    languages = sorted(language_counts.keys())

    # capture language distribution by uploaded location
    location_language_counts = {}

    location_language_df = raw_dataset_df[["location", "language"]].copy()
    location_language_df["location"] = (
        location_language_df["location"]
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
    )
    location_language_df["language"] = (
        location_language_df["language"]
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
    )

    location_language_df = location_language_df.dropna(
        subset=["location", "language"]
    )

    grouped_location_languages = (
        location_language_df
        .groupby(["location", "language"])
        .size()
    )

    for (location, language), count in grouped_location_languages.items():
        location_key = str(location)
        language_key = str(language)

        if location_key not in location_language_counts:
            location_language_counts[location_key] = {}

        location_language_counts[location_key][language_key] = int(count)

    # preview atleast 5% of total rows
    preview_row_count = 0
    
    if num_of_rows > 0:
        preview_row_count = min(
            num_of_rows,
            max(10, math.ceil(num_of_rows * 0.05)),
        )

    preview_headers = "+".join(RAW_DATASET_REQUIRED_HEADERS)

    preview_data = raw_dataset_df[RAW_DATASET_REQUIRED_HEADERS].head(preview_row_count).to_json(
        orient="records"
    )

    # Insert metadata
    to_encode.update(
        {
            "user_name": f"{user_data['first_name']} {user_data['last_name']}",
            "filename": filename,
            "original_filename": original_filename,
            "file_size": file_size,
            "num_of_rows": num_of_rows,
            "languages": languages,
            "language_counts": language_counts,
            "location_language_counts": location_language_counts,
            "preview_row_count": preview_row_count,
            "preview_headers": str(preview_headers),
            "preview_data": json.dumps(preview_data),
            "dataset_type": "RAW",
            "dataset_status": "UPLOADED",
            "description": "",
            "processing_error": "",
            "processed_at": None,
            "created_at": get_ph_datetime(),
        }
    )

    new_dataset = dataset_collection.insert_one(dict(to_encode))

    if not new_dataset:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload dataset",
        )

    #TEMP: disable automatic annotation during upload
    #HealthPH+ will process annotation as a separate dataset action/job
    """ background_tasks.add_task(
        annotate_dataset,
        dataset_data,
        filename,
        str(full_path),
        original_filename,
        f"{user_data['first_name']} {user_data['last_name']}",
    ) """

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Dataset uploaded successfully"},
    )


async def process_dataset(
    background_tasks: BackgroundTasks,
    id: str,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
):
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID",
        )
    
    dataset_data = dataset_collection.find_one({"_id": ObjectId(id)})

    if not dataset_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    
    if current_user["user_type"] != "SUPERADMIN":
        if str(dataset_data.get("user_id")) != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to process this dataset.",
            )
        
    if dataset_data.get("dataset_type") != "RAW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only raw datasets can be processed.",
        )
    
    if dataset_data.get("dataset_status") in ["QUEUED", "PROCESSING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset is already queued or processing.",
        )
    
    dataset_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "dataset_status": "QUEUED",
                "processing_error": "",
                "processed_at": None,
            }
        },
    )

    background_tasks.add_task(run_dataset_processing_job, id)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"message": "Dataset queued for processing"},
    )


"""
@desc     Download a single dataset by filename
route     GET api/datasets/download/{filename}
@access   Private
"""


async def download_dataset(
    id: str,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],

):
    # Check if there is id
    if not id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error downloading dataset...",
        )

    # Check if id is valid object ID
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to download dataset"
        )

    # Check if data exists in database
    dataset_data = dataset_collection.find_one({"_id": ObjectId(id)})

    if not (dataset_data):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )

    if current_user["user_type"] != "SUPERADMIN":
        if str(dataset_data.get("user_id")) != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to download this dataset.",
            )

    filename = dataset_data["filename"]

    # Check if dataset is RAW or ANNOTATED dataset
    if dataset_data["dataset_type"] == "RAW":
        full_path = datasets_folder / filename
    elif dataset_data["dataset_type"] == "ANNOTATED":
        full_path = annotated_datasets_folder / filename

    # full_path = datasets_folder / filename

    if not os.path.isfile(full_path):
        return {"message": f"File {filename} not found."}

    with open(full_path, "rb") as f:
        file_data = f.read()

    response = FileResponse(
        full_path, media_type="application/octet-stream", filename=filename
    )

    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return response


"""
@desc     Fetch all datasets
route     GET api/datasets
@access   Private
"""


async def fetch_datasets():
    data = dataset_collection.aggregate(
        [
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "user_data",
                }
            },
            {"$sort": {"created_at": pymongo.DESCENDING}},
        ]
    )

    datasets = list_datasets(data)

    return datasets


"""
@desc     Fetch all datasets uploaded by a specific user
route     GET api/datasets/user/{user_id}
@access   Private
"""


async def fetch_datasets_by_user(user_id: str):
    user_data = user_collection.find_one({"_id": ObjectId(user_id)})

    if user_data["user_type"] == "SUPERADMIN":
        data = dataset_collection.aggregate(
            [
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user_data",
                    }
                },
                {"$sort": {"created_at": pymongo.DESCENDING}},
            ]
        )
    elif user_data.get("role_label") == "Admin":
        data = dataset_collection.aggregate(
            [
                {"$match": {"user_id": user_id}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user_data",
                    }
                },
                {"$sort": {"created_at": pymongo.DESCENDING}},
            ]
        )
    else:
        return []

    datasets = list_datasets(data)

    return datasets


"""
@desc     Delete a single dataset
route     DELETE api/datasets/{id}
@access   Private
"""


async def delete_dataset(
    background_tasks: BackgroundTasks, 
    id: str,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))]
):
    # Check if there is id
    if not id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error deleting dataset...",
        )

    # Check if id is valid object ID
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete dataset"
        )

    # Check if data exists in database
    dataset_data = dataset_collection.find_one({"_id": ObjectId(id)})

    if not (dataset_data):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    
    if current_user["user_type"] != "SUPERADMIN":
        if str(dataset_data.get("user_id")) != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this dataset.",
            )

    deleted_dataset = dataset_collection.find_one_and_delete({"_id": ObjectId(id)})

    # If deletion failed
    if not deleted_dataset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete dataset.",
        )

    # Check if deleted dataset is RAW or ANNOTATED dataset
    if deleted_dataset["dataset_type"] == "RAW":
        full_path = datasets_folder / dataset_data["filename"]
    elif deleted_dataset["dataset_type"] == "ANNOTATED":
        full_path = annotated_datasets_folder / dataset_data["filename"]

    # Remove dataset from directory
    if os.path.exists(full_path):
        os.remove(full_path)

    background_tasks.add_task(delete_point, dataset_data["filename"])

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Dataset deleted successfully",
            "dataset": individual_dataset(deleted_dataset),
        },
    )


"""
@desc     Delete all datasets
route     DELETE api/datasets/all-datasets
@access   Private
"""


async def delete_all_datasets(
        current_user: Annotated[dict, Depends(require_role(["SUPERADMIN"]))]
):
    deleted = dataset_collection.delete_many({})

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting datasets...",
        )

    if os.path.exists(datasets_folder):
        shutil.rmtree("public/datasets")

        os.makedirs(datasets_folder, exist_ok=True)

    if os.path.exists(annotated_datasets_folder):
        shutil.rmtree("public/annotated_datasets")

        os.makedirs(annotated_datasets_folder, exist_ok=True)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "All datasets deleted successfully"},
    )
