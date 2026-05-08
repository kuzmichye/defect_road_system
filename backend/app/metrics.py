from prometheus_client import Counter, Histogram

defect_detections_total = Counter(
    "defect_detections_total",
    "Total number of detected defects",
    ["defect_type", "severity", "source_type"],
)

detection_duration_seconds = Histogram(
    "detection_duration_seconds",
    "Time spent on model inference",
    ["source_type"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)
