"""Recorded external training runs; importing a log never starts training."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

Text = Annotated[str, Field(min_length=1, max_length=200)]
PositiveCount = Annotated[StrictInt, Field(gt=0)]
FiniteNumber = Annotated[float, Field(strict=True, allow_inf_nan=False)]
ParameterName = Annotated[
    str,
    Field(min_length=1, max_length=100, pattern=r"^[A-Za-z][A-Za-z0-9_]*$"),
]
MetricName = Literal[
    "trainLoss",
    "validationLoss",
    "trainAccuracy",
    "validationAccuracy",
    "validationMacroF1",
    "validationMicroF1",
]


class TrainingEpoch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    epoch: PositiveCount
    metrics: Annotated[
        dict[MetricName, FiniteNumber], Field(min_length=1, max_length=6)
    ]

    @field_validator("metrics")
    @classmethod
    def validate_metrics(cls, values):
        for name, value in values.items():
            if name.endswith("Loss"):
                if value < 0:
                    raise ValueError("Loss cannot be negative.")
            elif not 0 <= value <= 1:
                raise ValueError("Accuracy and F1 must use values from 0 to 1.")
        return values


class TrainingLogUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Annotated[StrictInt, Field(ge=1, le=1)]
    runId: Text
    modelId: Literal["fasttext", "electra", "xlmr"]
    modelVersion: Text
    trainingDataset: Text
    validationDataset: Text | None = None
    status: Literal["completed", "failed", "cancelled"]
    startedAt: datetime
    endedAt: datetime
    hyperparameters: Annotated[
        dict[ParameterName, str | StrictInt | bool | FiniteNumber | None],
        Field(max_length=100),
    ] = Field(default_factory=dict)
    epochs: Annotated[list[TrainingEpoch], Field(max_length=10000)] = Field(default_factory=list)
    notes: Annotated[str, Field(max_length=5000)] | None = None

    @field_validator("runId", "modelVersion", "trainingDataset", "validationDataset")
    @classmethod
    def clean_metadata(cls, value):
        if value is None:
            return None
        value = value.strip()
        if not value or value.upper().startswith("REPLACE_"):
            raise ValueError("Replace placeholders with the actual training details.")
        return value

    @field_validator("startedAt", "endedAt", mode="before")
    @classmethod
    def validate_timestamp(cls, value):
        if not isinstance(value, str):
            raise ValueError(
                "Use a date and time with a timezone, "
                "such as 2026-11-10T09:00:00+08:00."
            )
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Include the timezone in the date and time.")
        return parsed

    @model_validator(mode="after")
    def validate_run(self):
        if self.endedAt < self.startedAt:
            raise ValueError("The end time cannot be earlier than the start time.")
        epoch_numbers = [row.epoch for row in self.epochs]
        if len(epoch_numbers) != len(set(epoch_numbers)):
            raise ValueError("Include each epoch only once.")
        self.epochs.sort(key=lambda row: row.epoch)
        return self
