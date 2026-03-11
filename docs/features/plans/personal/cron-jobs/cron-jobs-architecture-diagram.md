# Cron Jobs Architecture Diagram

## System Architecture

```mermaid
graph TB
    subgraph Railway["Railway Platform"]
        subgraph CronServices["Cron Services"]
            BT["Briefing Tech<br/>0 8 * * * UTC"]
            BL["Briefing Teclas<br/>0 8 * * * UTC"]
            YT["YT Transcript<br/>0 8 * * * UTC"]
            PT["Process Trans<br/>0 8 * * * UTC"]
        end

        subgraph API["NestJS API"]
            CJM["Cron Jobs Module"]
            BCS["BriefingCronService"]
            TCS["TranscriptCronService"]
            CJS["CronJobService<br/>Base"]
        end

        subgraph Resources["External Resources"]
            DB[(PostgreSQL)]
            REDIS[(Redis)]
            S3["AWS S3"]
            AI["AI Services<br/>OpenAI/DeepSeek"]
        end
    end

    BT -->|calls| BCS
    BL -->|calls| BCS
    YT -->|calls| TCS
    PT -->|calls| TCS

    BCS -->|extends| CJS
    TCS -->|extends| CJS

    BCS -->|uses| CJM
    TCS -->|uses| CJM

    CJS -->|manages| DB
    CJS -->|manages| REDIS
    CJS -->|manages| S3
    CJS -->|manages| AI

    style Railway fill:#e1f5ff
    style CronServices fill:#fff3e0
    style API fill:#f3e5f5
    style Resources fill:#e8f5e9
```

## Cron Job Execution Flow

```mermaid
sequenceDiagram
    participant Railway as Railway Scheduler
    participant Runner as Wrapper Script
    participant CronService as Cron Service
    participant UseCase as Use Case
    participant DB as Database
    participant App as NestJS App

    Railway->>Runner: Execute at scheduled time
    Runner->>App: Initialize NestJS context
    App->>DB: Connect
    Runner->>CronService: Call execute()
    CronService->>CronService: Log start
    CronService->>UseCase: Execute business logic
    UseCase->>DB: Query/Update data
    DB-->>UseCase: Return results
    UseCase-->>CronService: Return result
    CronService->>CronService: Log completion
    CronService->>App: Close context
    App->>DB: Disconnect
    App->>Runner: Context closed
    Runner->>Railway: Exit with status code
```

## Module Dependency Graph

```mermaid
graph LR
    CJM["CronJobsModule"]

    CJM -->|imports| BM["BriefingsModule"]
    CJM -->|imports| YTM["YoutubeTranscriptionsModule"]
    CJM -->|imports| DBM["DatabaseModule"]
    CJM -->|imports| QM["QueueModule"]

    BM -->|uses| BU["BriefingUseCases"]
    YTM -->|uses| YTU["TranscriptUseCases"]

    CJM -->|provides| BCS["BriefingCronService"]
    CJM -->|provides| TCS["TranscriptCronService"]

    BCS -->|uses| BU
    TCS -->|uses| YTU

    style CJM fill:#f3e5f5
    style BCS fill:#fff3e0
    style TCS fill:#fff3e0
```

## Cron Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Initialize: Railway triggers
    Initialize --> ValidateEnv: Load environment
    ValidateEnv --> CreateContext: Create NestJS context
    CreateContext --> ExecuteJob: Execute cron job
    ExecuteJob --> Success: Job completed
    ExecuteJob --> Error: Job failed
    Success --> Cleanup: Close resources
    Error --> Cleanup: Close resources
    Cleanup --> Exit: Exit process
    Exit --> [*]

    note right of Initialize
        Wrapper script starts
    end note

    note right of ExecuteJob
        Call appropriate service
        (BriefingCronService or
        TranscriptCronService)
    end note

    note right of Cleanup
        Close DB connections
        Close Redis connections
        Close app context
    end note
```

## Service Hierarchy

```mermaid
graph TD
    CJS["CronJobService<br/>(Abstract Base)"]

    CJS -->|extended by| BCS["BriefingCronService"]
    CJS -->|extended by| TCS["TranscriptCronService"]

    BCS -->|implements| BT["executeBriefingTech()"]
    BCS -->|implements| BL["executeBriefingTeclas()"]

    TCS -->|implements| YT["executeYoutubeTranscript()"]
    TCS -->|implements| PT["processTranscriptions()"]

    CJS -->|provides| Init["initialize()"]
    CJS -->|provides| Cleanup["cleanup()"]
    CJS -->|provides| Log["log()"]
    CJS -->|provides| Error["handleError()"]

    style CJS fill:#e3f2fd
    style BCS fill:#fff3e0
    style TCS fill:#fff3e0
```

## Data Flow for Briefing Cron Job

```mermaid
graph LR
    Start["Start<br/>briefing:tech"] -->|Initialize| App["NestJS App"]
    App -->|Get Service| BCS["BriefingCronService"]
    BCS -->|Call| RBU["RunBriefingUseCase"]

    RBU -->|Scrape| SA["ScrapeArticlesUseCase"]
    SA -->|Query| DB1[(Database)]
    DB1 -->|Articles| PA["ProcessArticlesUseCase"]

    PA -->|Process| RA["RateArticlesUseCase"]
    RA -->|Rate| CA["CategorizeArticlesUseCase"]
    CA -->|Categorize| GB["GenerateBriefUseCase"]

    GB -->|Generate| DB2[(Database)]
    DB2 -->|Briefing| End["End<br/>Exit"]

    style Start fill:#c8e6c9
    style End fill:#ffcdd2
    style BCS fill:#fff3e0
```

## Data Flow for Transcript Cron Job

```mermaid
graph LR
    Start["Start<br/>yt-transcript"] -->|Initialize| App["NestJS App"]
    App -->|Get Service| TCS["TranscriptCronService"]
    TCS -->|Call| ETU["ExtractYoutubeTranscriptsUseCase"]

    ETU -->|Get Channels| YCS["YoutubeChannelsService"]
    YCS -->|Query| DB1[(Database)]
    DB1 -->|Channels| ETU

    ETU -->|Extract| YTS["YoutubeTranscriptService"]
    YTS -->|Store| S3["AWS S3"]
    S3 -->|Save| DB2[(Database)]

    DB2 -->|Transcripts| End["End<br/>Exit"]

    style Start fill:#c8e6c9
    style End fill:#ffcdd2
    style TCS fill:#fff3e0
```

## Error Handling Flow

```mermaid
graph TD
    Execute["Execute Cron Job"]
    Execute -->|Success| Log1["Log Success"]
    Execute -->|Error| Catch["Catch Exception"]

    Catch -->|Log Error| Log2["Log Error Details"]
    Log2 -->|Determine Type| Type{Error Type}

    Type -->|Validation| Handle1["Handle Validation Error"]
    Type -->|Database| Handle2["Handle DB Error"]
    Type -->|External API| Handle3["Handle API Error"]
    Type -->|Unknown| Handle4["Handle Unknown Error"]

    Handle1 --> Cleanup["Cleanup Resources"]
    Handle2 --> Cleanup
    Handle3 --> Cleanup
    Handle4 --> Cleanup

    Log1 --> Cleanup
    Cleanup -->|Exit 0| Success["Success"]
    Cleanup -->|Exit 1| Failure["Failure"]

    style Execute fill:#e3f2fd
    style Catch fill:#ffebee
    style Success fill:#c8e6c9
    style Failure fill:#ffcdd2
```

## Railway Deployment Architecture

```mermaid
graph TB
    subgraph Railway["Railway Project"]
        subgraph Services["Services"]
            API["API Service<br/>Main Application"]
            BT["Briefing Tech<br/>Cron Service"]
            BL["Briefing Teclas<br/>Cron Service"]
            YT["YT Transcript<br/>Cron Service"]
            PT["Process Trans<br/>Cron Service"]
        end

        subgraph Shared["Shared Resources"]
            DB[(PostgreSQL)]
            REDIS[(Redis)]
        end
    end

    subgraph External["External Services"]
        S3["AWS S3"]
        AI["AI APIs"]
        YT_API["YouTube API"]
    end

    API -->|uses| DB
    API -->|uses| REDIS
    BT -->|uses| DB
    BT -->|uses| REDIS
    BL -->|uses| DB
    BL -->|uses| REDIS
    YT -->|uses| DB
    YT -->|uses| REDIS
    PT -->|uses| DB
    PT -->|uses| REDIS

    API -->|calls| S3
    BT -->|calls| S3
    BL -->|calls| S3
    YT -->|calls| S3
    PT -->|calls| S3

    BT -->|calls| AI
    BL -->|calls| AI
    YT -->|calls| YT_API

    style Railway fill:#e1f5ff
    style Services fill:#fff3e0
    style Shared fill:#f3e5f5
    style External fill:#e8f5e9
```
