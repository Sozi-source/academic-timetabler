$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required file not found: $Path"
    }

    return [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $Path).Path
    )
}

function Write-Text([string]$Path, [string]$Content) {
    $resolved = [System.IO.Path]::GetFullPath(
        (Join-Path $PWD.Path $Path)
    )

    $parent = [System.IO.Path]::GetDirectoryName($resolved)

    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $resolved,
        $Content,
        $utf8
    )
}

function Add-ModalImport([string]$Content) {
    $import =
        "import { CrudModal } from '@/components/ui/crud-modal';"

    if ($Content.Contains($import)) {
        return $Content
    }

    return $import + "`n" + $Content
}

function Remove-SideFormGrid([string]$Content) {
    # Existing CRUD pages use a two-column grid to place the creation
    # form beside the records. Replace only responsive grid classes that
    # explicitly define two columns. Other page grids are left alone.
    $classPattern =
        'className="([^"]*\bgrid\b[^"]*(?:lg|xl):grid-cols-(?:2|\[[^"]+\])[^"]*)"'

    $regex = [System.Text.RegularExpressions.Regex]::new(
        $classPattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $match = $regex.Match($Content)

    if (-not $match.Success) {
        return $Content
    }

    $replacementClasses = "space-y-4"

    return (
        $Content.Substring(0, $match.Groups[1].Index) +
        $replacementClasses +
        $Content.Substring(
            $match.Groups[1].Index +
            $match.Groups[1].Length
        )
    )
}

function Convert-CreateFormToModal(
    [string]$Path,
    [string]$FormName,
    [string]$Title,
    [string]$TriggerLabel,
    [string]$Description,
    [string]$WidthClass
) {
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "Skipped missing route: $Path" -ForegroundColor DarkGray
        return $false
    }

    $content = Read-Text $Path

    if (
        $content -match
        "<CrudModal[\s\S]*?triggerLabel=`"$([regex]::Escape($TriggerLabel))`""
    ) {
        Write-Host "Already modalized: $Path" -ForegroundColor DarkGray
        return $true
    }

    $formPattern =
        "<$FormName\b[\s\S]*?/>"

    $formRegex = [System.Text.RegularExpressions.Regex]::new(
        $formPattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $formMatch = $formRegex.Match($content)

    if (-not $formMatch.Success) {
        Write-Warning "$FormName was not found safely in $Path. Page skipped."
        return $false
    }

    $existingForm = $formMatch.Value

    $modalBlock = @"
<CrudModal
          title="$Title"
          description="$Description"
          triggerLabel="$TriggerLabel"
          widthClassName="$WidthClass"
        >
          $existingForm
        </CrudModal>
"@

    $content =
        $content.Substring(0, $formMatch.Index) +
        $modalBlock +
        $content.Substring(
            $formMatch.Index +
            $formMatch.Length
        )

    $content = Add-ModalImport $content
    $content = Remove-SideFormGrid $content

    Write-Text $Path $content

    Write-Host "Modalized: $Path" -ForegroundColor Green
    return $true
}

Write-Host ""
Write-Host "Applying v12.14.8 Full-width CRUD Workspace Standardization..." -ForegroundColor Cyan

# Ensure shared modal exists after ZIP extraction.
if (-not (Test-Path "src\components\ui\crud-modal.tsx")) {
    throw "crud-modal.tsx was not extracted."
}

$converted = 0

$targets = @(
    @{
        Path = "src\app\(dashboard)\timetable\academic-years\page.tsx"
        Form = "CreateAcademicYearForm"
        Title = "Create Academic Year"
        Trigger = "Create Academic Year"
        Description = "Add a new institutional academic year."
        Width = "max-w-xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\academic-periods\page.tsx"
        Form = "CreateAcademicPeriodForm"
        Title = "Create Academic Period"
        Trigger = "Create Academic Period"
        Description = "Add a teaching period to the academic calendar."
        Width = "max-w-2xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\programmes\page.tsx"
        Form = "CreateProgrammeForm"
        Title = "Create Programme"
        Trigger = "Create Programme"
        Description = "Register a programme without reducing the records workspace."
        Width = "max-w-2xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\cohorts\page.tsx"
        Form = "CreateCohortForm"
        Title = "Create Cohort"
        Trigger = "Create Cohort"
        Description = "Create a class or cohort and keep the register full width."
        Width = "max-w-3xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\units\page.tsx"
        Form = "CreateUnitForm"
        Title = "Create Curriculum Unit"
        Trigger = "Create Unit"
        Description = "Register a curriculum unit."
        Width = "max-w-3xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\trainers\page.tsx"
        Form = "CreateTrainerForm"
        Title = "Create Trainer"
        Trigger = "Create Trainer"
        Description = "Add a trainer to the shared trainer pool."
        Width = "max-w-2xl"
    },
    @{
        Path = "src\app\(dashboard)\timetable\rooms\page.tsx"
        Form = "CreateRoomForm"
        Title = "Create Room"
        Trigger = "Create Room"
        Description = "Register a teaching venue."
        Width = "max-w-2xl"
    }
)

foreach ($target in $targets) {
    $result = Convert-CreateFormToModal `
        -Path $target.Path `
        -FormName $target.Form `
        -Title $target.Title `
        -TriggerLabel $target.Trigger `
        -Description $target.Description `
        -WidthClass $target.Width

    if ($result) {
        $converted++
    }
}

# Teaching Sessions is intentionally handled only when a single exposed
# CreateTimeSlotForm exists. Pages with separate working-day and time-slot
# workflows are not collapsed automatically.
$timeSlotPage =
    "src\app\(dashboard)\timetable\time-slots\page.tsx"

if (Test-Path -LiteralPath $timeSlotPage) {
    $timeSlotContent = Read-Text $timeSlotPage

    $timeSlotCount =
        ([regex]::Matches(
            $timeSlotContent,
            '<CreateTimeSlotForm\b'
        )).Count

    $workingDayCount =
        ([regex]::Matches(
            $timeSlotContent,
            '<CreateWorkingDayForm\b'
        )).Count

    if ($timeSlotCount -eq 1 -and $workingDayCount -eq 0) {
        $result = Convert-CreateFormToModal `
            -Path $timeSlotPage `
            -FormName "CreateTimeSlotForm" `
            -Title "Create Teaching Session" `
            -TriggerLabel "Create Teaching Session" `
            -Description "Add a teaching session to the timetable calendar." `
            -WidthClass "max-w-2xl"

        if ($result) {
            $converted++
        }
    }
    else {
        Write-Host `
            "Teaching Sessions kept unchanged because it contains a compound calendar workflow." `
            -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "v12.14.8 applied successfully." -ForegroundColor Green
Write-Host "$converted CRUD page(s) converted to full-width records + modal creation." -ForegroundColor Cyan
Write-Host "Complex/import/generator/editor pages were not changed." -ForegroundColor DarkGray
Write-Host "No database changes were made." -ForegroundColor Cyan
