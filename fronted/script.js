const HISTORY_KEY = "testpilotRecords";
const LEGACY_HISTORY_KEY = "testpilotHistory";
const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");
const toast = document.getElementById("toast");
let toastTimer;
let currentBugReport = null;

const pageNames = {
    dashboard: "Dashboard",
    analyzer: "Requirement Analyzer",
    testcases: "Test Case Generator",
    bugreport: "Bug Report Generator",
    summary: "Test Summary",
    history: "History",
    settings: "Settings",
    scenarios: "Test Scenario Generator",
    documents: "QA Document Generator",
    impact: "Change Impact Analyzer",
    promptlab: "Prompt Lab"
};
const historyTypes = {
    analysis: "Requirement analysis",
    scenarios: "Test scenarios",
    testcases: "Test cases",
    document: "QA document",
    bug: "Bug report",
    impact: "Change impact",
    prompt: "Prompt evaluation"
};

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function showPage(pageId) {
    const selectedPage = document.getElementById(pageId);
    if (!selectedPage) return;
    pages.forEach(page => page.classList.toggle("active", page === selectedPage));
    navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === pageId));
    pageTitle.textContent = pageNames[pageId] || "Dashboard";
    if (pageId === "settings") {
        document.querySelectorAll(".settings-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.settings === "api");
        });
        document.querySelectorAll(".settings-section").forEach(section => {
            section.classList.toggle("active", section.id === "settings-api");
        });
    }
    document.getElementById("notificationPopover").hidden = true;
    if (pageId === "testcases") renderLatestTestCases();
    if (pageId === "summary") renderTestSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

navLinks.forEach(link => link.addEventListener("click", () => showPage(link.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", event => {
        if (button.tagName === "A") event.preventDefault();
        showPage(button.dataset.go);
    });
});

document.getElementById("notificationBtn").addEventListener("click", () => {
    const popover = document.getElementById("notificationPopover");
    popover.hidden = !popover.hidden;
});

const globalSearch = document.getElementById("globalSearch");
globalSearch.addEventListener("keydown", event => {
    if (event.key === "Enter" && globalSearch.value.trim()) {
        showPage("history");
        document.getElementById("historySearch").value = globalSearch.value.trim();
        filterHistory();
    }
});
document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        globalSearch.focus();
    }
});

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function getRecords() {
    let records;
    try {
        const current = localStorage.getItem(HISTORY_KEY);
        if (current === null) {
            const previousHistory = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
            records = Array.isArray(previousHistory) ? previousHistory.map(item => ({
                id: `legacy-${item.id || Math.random().toString(16).slice(2)}`,
                type: ["analysis", "testcases", "bug"].includes(item.type) ? item.type : "analysis",
                title: String(item.title || item.label || "Older activity"),
                createdAt: item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date).toISOString() : new Date(0).toISOString(),
                input: null,
                result: { legacyNotice: "This older record contains activity metadata only. Its generated result was not stored by the earlier version of TestPilot." },
                legacy: true
            })) : [];
            localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
        } else {
            records = JSON.parse(current);
        }
    } catch (error) {
        console.error("Unable to read saved history:", error);
        throw new Error("Saved history is unreadable. Clear browser storage or remove the invalid TestPilot history entry.");
    }
    if (!Array.isArray(records)) throw new Error("Saved history has an invalid format.");
    return records.filter(record => record && typeof record.id === "string" && typeof record.type === "string");
}

function writeRecords(records) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
    } catch (error) {
        console.error("Unable to save application data:", error);
        throw new Error("Unable to save data in browser storage. Check available storage space.");
    }
}

function saveRecord(type, title, input, result) {
    const record = {
        id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        title: String(title || historyTypes[type]).slice(0, 120),
        createdAt: new Date().toISOString(),
        input,
        result
    };
    const records = getRecords();
    records.unshift(record);
    writeRecords(records.slice(0, 100));
    refreshDataViews();
    return record;
}

function updateRecord(recordId, update) {
    const records = getRecords();
    const index = records.findIndex(record => record.id === recordId);
    if (index < 0) throw new Error("This saved result is no longer available.");
    records[index] = update(records[index]);
    writeRecords(records);
    refreshDataViews();
    return records[index];
}

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function summarizeInput(record) {
    const input = record.input;
    if (typeof input === "string") return input.slice(0, 95);
    if (input && typeof input === "object") {
        const text = input.requirement || input.projectInformation || input.title || input.prompt ||
            input.updatedRequirement || input.description || "";
        return String(text).slice(0, 95);
    }
    return "";
}

function formatResultText(type, result) {
    if (typeof result === "string") return result;
    if (!result || typeof result !== "object") return String(result ?? "");
    if (result.legacyNotice) return result.legacyNotice;
    if (type === "analysis") {
        const labels = {
            summary: "Requirement Summary",
            functionalRequirements: "Functional Requirements",
            nonFunctionalRequirements: "Non-functional Requirements",
            missingRequirements: "Missing Requirements",
            ambiguousRequirements: "Ambiguous Requirements",
            inconsistentRequirements: "Inconsistent Requirements",
            importantObservations: "Important Observations",
            suggestionsForImprovement: "Suggestions for Improvement"
        };
        return Object.entries(labels).map(([key, label]) => {
            const value = result[key];
            return `${label}\n${Array.isArray(value) ? (value.length ? value.map(item => `• ${item}`).join("\n") : "None identified.") : value || "Not specified"}`;
        }).join("\n\n");
    }
    if (type === "testcases" && Array.isArray(result.testCases)) {
        return result.testCases.map(test => [
            `${test.id} — ${test.scenario}`,
            `Preconditions: ${test.preconditions}`,
            `Steps:\n${(test.steps || []).map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
            `Test data: ${test.testData}`,
            `Expected result: ${test.expectedResult}`,
            `Priority: ${test.priority} · Status: ${test.executionStatus}`
        ].join("\n")).join("\n\n");
    }
    if (type === "document" && result.sections) {
        return `${result.title}\n${result.sections.map(section => `\n${section.heading}\n${section.content}`).join("\n")}`;
    }
    if (type === "bug") {
        return [
            `Bug ID: ${result.bugId}`, `Bug summary: ${result.title}`,
            `Description: ${result.description}`, `Reproduction steps: ${result.steps || "Not provided"}`,
            `Expected result: ${result.expectedResult || "Not provided"}`,
            `Actual result: ${result.actualResult || "Not provided"}`,
            `Severity: ${result.severity}`, `Priority: ${result.priority}`,
            `Testing observations:\n${(result.testingObservations || []).map(item => `• ${item}`).join("\n")}`
        ].join("\n\n");
    }
    if (type === "prompt" && result.assessment) {
        return [
            "Prompt quality assessment",
            ...Object.entries(result.assessment).map(([name, value]) => `${name}: ${value.score}/5 — ${value.explanation}`),
            `\nWeaknesses:\n${(result.weaknesses || []).map(item => `• ${item}`).join("\n") || "None identified."}`,
            `\nImprovement suggestions:\n${(result.improvementSuggestions || []).map(item => `• ${item}`).join("\n") || "None identified."}`,
            `\nImproved prompt:\n${result.improvedPrompt}`
        ].join("\n");
    }
    return JSON.stringify(result, null, 2);
}

function setButtonLoading(button, isLoading, label) {
    if (isLoading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.textContent = label;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalHtml || label;
        delete button.dataset.originalHtml;
    }
}

function getApiBaseUrl() {
    let configured = "";
    try {
        configured = localStorage.getItem("testpilotApiBaseUrl") || "";
    } catch (error) {
        console.error("Unable to read API settings:", error);
    }
    const value = (configured || "http://localhost:5000").trim().replace(/\/+$/, "");
    let parsed;
    try {
        parsed = new URL(value);
    } catch (error) {
        throw new Error("Backend base URL must be a valid HTTP or HTTPS URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        throw new Error("Backend base URL must contain only an HTTP(S) origin, such as http://localhost:5000.");
    }
    return parsed.origin;
}

async function apiRequest(route, body) {
    let response;
    try {
        response = await fetch(`${getApiBaseUrl()}${route}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
    } catch (error) {
        throw new Error("Cannot reach the TestPilot backend. Start it with `npm start` and try again.");
    }
    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error(`The backend returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok || data.success !== true) {
        throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    }
    return data;
}

function showApiError(error) {
    console.error("TestPilot request failed:", error);
    showToast(error.message || "The request could not be completed.");
}

function downloadText(filename, content, type = "text/plain") {
    const fileUrl = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
}

async function copyText(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard.`);
    } catch (error) {
        console.error(`Unable to copy ${label.toLowerCase()}:`, error);
        showToast("Clipboard access is unavailable. Use the export option instead.");
    }
}

function recordTitle(value, fallback) {
    const text = String(value || "").trim();
    return text ? text.slice(0, 72) : fallback;
}

const requirementInput = document.getElementById("requirement");
const analysisOutput = document.getElementById("output");
const defaultAnalysis = "No analysis generated yet. Enter a requirement above to get started.";
requirementInput.addEventListener("input", () => {
    document.getElementById("charCount").textContent = `${requirementInput.value.length} / 10000`;
});
document.getElementById("uploadBtn").addEventListener("click", () => document.getElementById("requirementFile").click());
document.getElementById("requirementFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        showToast("That file is over 10 MB. Choose a smaller document.");
        event.target.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const content = String(reader.result || "");
        requirementInput.value = content.slice(0, 10000);
        requirementInput.dispatchEvent(new Event("input"));
        document.getElementById("fileName").textContent = file.name;
        if (content.length > 10000) showToast("Document loaded. Input was limited to 10,000 characters.");
    };
    reader.onerror = () => showToast("Unable to read this file. Please try another.");
    reader.readAsText(file);
});

function renderAnalysis(result) {
    const labels = {
        summary: "Requirement Summary",
        functionalRequirements: "Functional Requirements",
        nonFunctionalRequirements: "Non-functional Requirements",
        missingRequirements: "Missing Requirements",
        ambiguousRequirements: "Ambiguous Requirements",
        inconsistentRequirements: "Inconsistent Requirements",
        importantObservations: "Important Observations",
        suggestionsForImprovement: "Suggestions for Improvement"
    };
    analysisOutput.textContent = Object.entries(labels).map(([key, label]) => {
        const value = result[key];
        const content = Array.isArray(value) ? (value.length ? value.map(item => `• ${item}`).join("\n") : "None identified.") : value;
        return `${label}\n${content || "Not specified"}`;
    }).join("\n\n");
    analysisOutput.hidden = false;
    document.getElementById("analysisEmpty").hidden = true;
}

document.getElementById("analyzeBtn").addEventListener("click", async event => {
    const requirement = requirementInput.value.trim();
    if (!requirement) {
        showToast("Enter a requirement before starting the analysis.");
        requirementInput.focus();
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Analyzing...");
    document.getElementById("resultStatus").textContent = "Analyzing your requirement...";
    try {
        const data = await apiRequest("/api/analyze-requirement", { requirement });
        renderAnalysis(data.analysis);
        document.getElementById("resultStatus").textContent = "Analysis complete · Review your QA insights below.";
        saveRecord("analysis", recordTitle(requirement, "Requirement analysis"), { requirement }, data.analysis);
        showToast("Requirement analysis complete and saved to history.");
    } catch (error) {
        document.getElementById("resultStatus").textContent = "Analysis could not be completed.";
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Analyze requirement");
    }
});
document.getElementById("clearBtn").addEventListener("click", () => {
    requirementInput.value = "";
    requirementInput.dispatchEvent(new Event("input"));
    document.getElementById("requirementFile").value = "";
    document.getElementById("fileName").textContent = "TXT, MD or CSV · max 10 MB";
    analysisOutput.textContent = defaultAnalysis;
    analysisOutput.hidden = true;
    document.getElementById("analysisEmpty").hidden = false;
    document.getElementById("resultStatus").textContent = "Your structured QA insights will appear here.";
});
document.getElementById("copyBtn").addEventListener("click", () => {
    if (analysisOutput.hidden || analysisOutput.textContent === defaultAnalysis) return showToast("There are no analysis results to copy.");
    copyText(analysisOutput.textContent, "Analysis");
});
document.getElementById("exportBtn").addEventListener("click", () => {
    if (analysisOutput.hidden || analysisOutput.textContent === defaultAnalysis) return showToast("There are no analysis results to export.");
    downloadText("TestPilot-Requirement-Analysis.txt", analysisOutput.textContent);
});

function renderScenarios(scenarios) {
    return scenarios.map(item => `${item.id} | ${item.type} | ${item.priority}\n${item.description}`).join("\n\n");
}

document.getElementById("scenarioBtn").addEventListener("click", async event => {
    const requirement = document.getElementById("scenarioInput").value.trim();
    if (!requirement) {
        showToast("Enter a requirement before generating scenarios.");
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Generating...");
    try {
        const data = await apiRequest("/api/generate-test-scenarios", { requirement });
        if (!Array.isArray(data.scenarios)) throw new Error("The backend returned invalid test scenarios.");
        const result = { scenarios: data.scenarios };
        document.getElementById("scenarioOutput").textContent = data.scenarios.length ? renderScenarios(data.scenarios) : "No testable scenarios could be derived from this requirement.";
        saveRecord("scenarios", recordTitle(requirement, "Test scenarios"), { requirement }, result);
        showToast("Requirement-based scenarios generated and saved.");
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Generate scenarios");
    }
});

document.getElementById("copyScenariosBtn").addEventListener("click", () => {
    const value = document.getElementById("scenarioOutput").textContent;
    if (value === "No scenarios generated yet.") return showToast("There are no scenarios to copy.");
    copyText(value, "Test scenarios");
});
document.getElementById("exportScenariosBtn").addEventListener("click", () => {
    const value = document.getElementById("scenarioOutput").textContent;
    if (value === "No scenarios generated yet.") return showToast("There are no scenarios to export.");
    downloadText("TestPilot-Test-Scenarios.txt", value);
});

function latestRecord(type) {
    return getRecords().find(record => record.type === type);
}

function renderLatestTestCases() {
    let record;
    try {
        record = latestRecord("testcases");
    } catch (error) {
        showApiError(error);
        return;
    }
    renderTestCaseRows(record);
}

function renderTestCaseRows(record) {
    const tbody = document.getElementById("testcaseRows");
    const empty = document.getElementById("testcaseEmpty");
    const cases = record && record.result && Array.isArray(record.result.testCases) ? record.result.testCases : [];
    document.getElementById("testcaseCount").textContent = cases.length;
    empty.hidden = cases.length > 0;
    tbody.innerHTML = cases.map((test, index) => `<tr>
        <td class="case-id">${escapeHtml(test.id)}</td>
        <td><strong>${escapeHtml(test.scenario)}</strong></td>
        <td>${escapeHtml(test.preconditions || "None specified")}</td>
        <td>${escapeHtml((test.steps || []).map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n")).replace(/\n/g, "<br>")}</td>
        <td>${escapeHtml(test.testData || "Not specified")}</td>
        <td>${escapeHtml(test.expectedResult)}</td>
        <td><span class="priority ${(test.priority || "Medium").toLowerCase()}">${escapeHtml(test.priority)}</span></td>
        <td><select class="compact-select case-status" data-record-id="${escapeHtml(record.id)}" data-case-index="${index}" aria-label="Manual execution status for ${escapeHtml(test.id)}"><option${test.executionStatus === "Pending" ? " selected" : ""}>Pending</option><option${["Pass", "Passed"].includes(test.executionStatus) ? " selected" : ""}>Pass</option><option${["Fail", "Failed"].includes(test.executionStatus) ? " selected" : ""}>Fail</option></select></td>
    </tr>`).join("");
}

document.getElementById("testcaseBtn").addEventListener("click", async event => {
    const requirement = document.getElementById("testcaseInput").value.trim();
    if (!requirement) {
        showToast("Add a requirement or scenario to generate test cases.");
        document.getElementById("testcaseInput").focus();
        return;
    }
    let scenarios = [];
    try {
        const scenarioRecord = latestRecord("scenarios");
        if (scenarioRecord && scenarioRecord.input &&
            String(scenarioRecord.input.requirement || "").trim() === requirement &&
            scenarioRecord.result.scenarios) {
            scenarios = scenarioRecord.result.scenarios.map(item => item.description);
        }
    } catch (error) {
        showApiError(error);
        return;
    }
    let preferences = {};
    try {
        preferences = JSON.parse(localStorage.getItem("testpilotPreferences") || "{}");
    } catch (error) {
        console.error("Unable to read test preferences:", error);
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Generating...");
    try {
        const data = await apiRequest("/api/generate-test-cases", {
            requirement, scenarios, defaultPriority: preferences.priority || "Medium"
        });
        if (!Array.isArray(data.testCases)) throw new Error("The backend returned invalid test cases.");
        const cases = data.testCases.map((test, index) => ({
            ...test,
            id: `TC-${String(index + 1).padStart(3, "0")}`,
            executionStatus: "Pending",
            statusUpdatedAt: null
        }));
        const record = saveRecord("testcases", recordTitle(requirement, "Test cases"), { requirement, scenarios }, { testCases: cases });
        renderTestCaseRows(record);
        showToast(`${cases.length} test cases generated. Mark execution status manually.`);
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Generate test cases");
    }
});

document.getElementById("testcaseRows").addEventListener("change", event => {
    if (!event.target.matches(".case-status")) return;
    const recordId = event.target.dataset.recordId;
    const index = Number(event.target.dataset.caseIndex);
    try {
        const record = updateRecord(recordId, current => {
            const cases = current.result.testCases;
            if (!cases || !cases[index]) throw new Error("The selected test case was not found.");
            cases[index].executionStatus = event.target.value;
            cases[index].statusUpdatedAt = new Date().toISOString();
            return current;
        });
        renderTestCaseRows(record);
        showToast("Manual execution status saved.");
    } catch (error) {
        showApiError(error);
    }
});

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getVisibleTestCases() {
    const record = latestRecord("testcases");
    return record && record.result && Array.isArray(record.result.testCases) ? record.result.testCases : [];
}

document.getElementById("exportCasesBtn").addEventListener("click", () => {
    try {
        const cases = getVisibleTestCases();
        if (!cases.length) return showToast("Generate test cases before exporting.");
        const rows = [["Test Case ID", "Test Scenario", "Preconditions", "Test Steps", "Test Data", "Expected Result", "Priority", "Execution Status"]];
        cases.forEach(test => rows.push([
            test.id, test.scenario, test.preconditions, (test.steps || []).join(" | "),
            test.testData, test.expectedResult, test.priority, test.executionStatus
        ]));
        downloadText("TestPilot-Test-Cases.csv", rows.map(row => row.map(csvEscape).join(",")).join("\r\n"), "text/csv");
    } catch (error) {
        showApiError(error);
    }
});
document.getElementById("copyCasesBtn").addEventListener("click", () => {
    try {
        const cases = getVisibleTestCases();
        if (!cases.length) return showToast("Generate test cases before copying.");
        copyText(formatResultText("testcases", { testCases: cases }), "Test cases");
    } catch (error) {
        showApiError(error);
    }
});

function getBugInput() {
    return {
        title: document.getElementById("bugTitle").value.trim(),
        description: document.getElementById("bugDescription").value.trim(),
        steps: document.getElementById("bugSteps").value.trim(),
        expectedResult: document.getElementById("bugExpected").value.trim(),
        actualResult: document.getElementById("bugActual").value.trim(),
        severity: document.getElementById("bugSeverity").value,
        priority: document.getElementById("bugPriority").value
    };
}

function renderBugReport(report) {
    const fields = [
        ["Bug ID", report.bugId], ["Bug summary", report.title],
        ["Detailed description", report.description], ["Reproduction steps", report.steps || "Not provided"],
        ["Expected result", report.expectedResult || "Not provided"],
        ["Actual result", report.actualResult || "Not provided"],
        ["Severity", report.severity], ["Priority", report.priority],
        ["Testing observations", (report.testingObservations || []).join("\n")]
    ];
    document.getElementById("bugPreviewContent").innerHTML =
        `<div class="bug-report-output"><h4>${escapeHtml(report.title)}</h4><dl>${fields.map(([name, value]) => `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl></div>`;
}

document.getElementById("generateBugBtn").addEventListener("click", async event => {
    const input = getBugInput();
    if (!input.title || !input.description) {
        showToast("Add a bug title and description to create a report.");
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Creating...");
    try {
        const data = await apiRequest("/api/generate-bug-report", input);
        currentBugReport = data.report;
        renderBugReport(currentBugReport);
        saveRecord("bug", recordTitle(currentBugReport.title, "Bug report"), input, currentBugReport);
        showToast("Bug report created and saved to history.");
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Create bug report");
    }
});
document.getElementById("clearBugBtn").addEventListener("click", () => {
    document.querySelectorAll("#bugreport input, #bugreport textarea").forEach(input => { input.value = ""; });
    document.getElementById("bugSeverity").selectedIndex = 0;
    document.getElementById("bugPriority").selectedIndex = 0;
    currentBugReport = null;
    document.getElementById("bugPreviewContent").innerHTML = '<div class="preview-placeholder"><span>⚑</span><strong>Your report will take shape here</strong><p>Fill in the issue details and create a report preview.</p></div>';
});
document.getElementById("copyBugBtn").addEventListener("click", () => {
    if (!currentBugReport) return showToast("Create a bug report before copying.");
    copyText(formatResultText("bug", currentBugReport), "Bug report");
});
document.getElementById("exportBugBtn").addEventListener("click", () => {
    if (!currentBugReport) return showToast("Create a bug report before exporting.");
    downloadText(`${currentBugReport.bugId}.txt`, formatResultText("bug", currentBugReport));
});

function formatDocument(documentData) {
    return `${documentData.title}\n\n${documentData.sections.map(section => `${section.heading}\n${section.content}`).join("\n\n")}`;
}

document.getElementById("documentBtn").addEventListener("click", async event => {
    const documentType = document.getElementById("documentType").value;
    const projectInformation = document.getElementById("documentInput").value.trim();
    if (!documentType || !projectInformation) {
        showToast("Choose a document type and enter project information.");
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Generating...");
    try {
        const savedCases = allTestCases();
        const passed = savedCases.filter(test => ["Pass", "Passed"].includes(test.executionStatus)).length;
        const failed = savedCases.filter(test => ["Fail", "Failed"].includes(test.executionStatus)).length;
        const pending = savedCases.length - passed - failed;
        const context = {
            documentType,
            projectInformation,
            testCases: savedCases,
            testSummary: {
                total: savedCases.length, passed, failed, pending,
                passPercentage: savedCases.length ? Math.round((passed / savedCases.length) * 100) : 0
            },
            scenarios: (latestRecord("scenarios") || { result: { scenarios: [] } }).result.scenarios || []
        };
        const data = await apiRequest("/api/generate-qa-document", {
            documentType,
            projectInformation: JSON.stringify(context)
        });
        const result = data.document;
        document.getElementById("documentOutput").textContent = formatDocument(result);
        saveRecord("document", recordTitle(`${documentType}: ${projectInformation}`, documentType), context, result);
        showToast(`${documentType} generated and saved to history.`);
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Generate document");
    }
});
document.getElementById("copyDocumentBtn").addEventListener("click", () => {
    const value = document.getElementById("documentOutput").textContent;
    if (value === "No document generated yet.") return showToast("Generate a document before copying.");
    copyText(value, "QA document");
});
document.getElementById("exportDocumentBtn").addEventListener("click", () => {
    const value = document.getElementById("documentOutput").textContent;
    if (value === "No document generated yet.") return showToast("Generate a document before exporting.");
    downloadText("TestPilot-QA-Document.txt", value);
});

document.getElementById("impactBtn").addEventListener("click", async event => {
    const previousRequirement = document.getElementById("oldRequirement").value.trim();
    const updatedRequirement = document.getElementById("newRequirement").value.trim();
    if (!previousRequirement || !updatedRequirement) {
        showToast("Enter both the previous and updated requirements.");
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Comparing...");
    try {
        const data = await apiRequest("/api/analyze-change-impact", { previousRequirement, updatedRequirement });
        const input = { previousRequirement, updatedRequirement };
        document.getElementById("impactOutput").textContent = JSON.stringify(data.impact, null, 2);
        saveRecord("impact", recordTitle(updatedRequirement, "Change impact analysis"), input, data.impact);
        showToast("Change impact analysis complete and saved.");
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Analyze changes");
    }
});
document.getElementById("copyImpactBtn").addEventListener("click", () => {
    const value = document.getElementById("impactOutput").textContent;
    if (value === "No impact analysis generated yet.") return showToast("Run an impact analysis before copying.");
    copyText(value, "Impact analysis");
});
document.getElementById("exportImpactBtn").addEventListener("click", () => {
    const value = document.getElementById("impactOutput").textContent;
    if (value === "No impact analysis generated yet.") return showToast("Run an impact analysis before exporting.");
    downloadText("TestPilot-Change-Impact.txt", value);
});

document.getElementById("promptBtn").addEventListener("click", async event => {
    const prompt = document.getElementById("promptInput").value.trim();
    const category = document.getElementById("promptFeature").value;
    if (!prompt) {
        showToast("Enter a prompt to evaluate.");
        return;
    }
    const button = event.currentTarget;
    setButtonLoading(button, true, "Evaluating...");
    try {
        const data = await apiRequest("/api/evaluate-prompt", { prompt, category });
        const result = data.evaluation;
        document.getElementById("promptOutput").textContent = formatResultText("prompt", result);
        saveRecord("prompt", recordTitle(prompt, "Prompt evaluation"), { prompt, category }, result);
        showToast("Prompt evaluation complete and saved.");
    } catch (error) {
        showApiError(error);
    } finally {
        setButtonLoading(button, false, "Evaluate prompt");
    }
});
document.getElementById("copyPromptBtn").addEventListener("click", () => {
    const value = document.getElementById("promptOutput").textContent;
    if (value === "No prompt evaluation generated yet.") return showToast("Evaluate a prompt before copying.");
    copyText(value, "Prompt evaluation");
});
document.getElementById("exportPromptBtn").addEventListener("click", () => {
    const value = document.getElementById("promptOutput").textContent;
    if (value === "No prompt evaluation generated yet.") return showToast("Evaluate a prompt before exporting.");
    downloadText("TestPilot-Prompt-Evaluation.txt", value);
});

function allTestCases(records = getRecords()) {
    return records.filter(record => record.type === "testcases" && record.result && Array.isArray(record.result.testCases))
        .flatMap(record => record.result.testCases);
}

function renderTestSummary() {
    let cases;
    try {
        cases = allTestCases();
    } catch (error) {
        showApiError(error);
        return;
    }
    const total = cases.length;
    const passed = cases.filter(test => ["Pass", "Passed"].includes(test.executionStatus)).length;
    const failed = cases.filter(test => ["Fail", "Failed"].includes(test.executionStatus)).length;
    const pending = total - passed - failed;
    const passPercent = total ? Math.round((passed / total) * 100) : 0;
    const failedPercent = total ? Math.round((failed / total) * 100) : 0;
    const pendingPercent = total ? Math.max(0, 100 - passPercent - failedPercent) : 0;

    document.getElementById("summaryTotal").textContent = total;
    document.getElementById("summaryPassed").textContent = passed;
    document.getElementById("summaryFailed").textContent = failed;
    document.getElementById("summaryPending").textContent = pending;
    document.getElementById("summaryPassedPercent").textContent = `${passPercent}% of all tests`;
    document.getElementById("summaryFailedPercent").textContent = `${failed} need attention`;
    document.getElementById("summaryLegendPassed").textContent = passed;
    document.getElementById("summaryLegendFailed").textContent = failed;
    document.getElementById("summaryLegendPending").textContent = pending;
    document.getElementById("summaryLegendTotal").textContent = total;
    document.getElementById("summaryLegendPassedPct").textContent = `${passPercent}%`;
    document.getElementById("summaryLegendFailedPct").textContent = `${failedPercent}%`;
    document.getElementById("summaryLegendPendingPct").textContent = `${pendingPercent}%`;
    document.getElementById("summaryPassRate").innerHTML = `${passPercent}<span>%</span>`;
    document.getElementById("summaryRing").style.background = total
        ? `conic-gradient(#a478f4 0 ${passPercent}%, #eb718e ${passPercent}% ${passPercent + failedPercent}%, #866735 ${passPercent + failedPercent}% 100%)`
        : "#272331";

    const title = document.getElementById("summaryStatusTitle");
    const text = document.getElementById("summaryStatusText");
    if (!total) {
        title.textContent = "No test cases yet";
        text.textContent = "Generate test cases and update their status to build a project summary.";
        document.getElementById("summaryRunDate").textContent = "No test cases";
        document.getElementById("summaryRecommendations").textContent = "There are no saved test cases to summarize yet.";
    } else if (failed) {
        title.textContent = "Testing needs attention";
        text.textContent = `${failed} failed test case${failed === 1 ? "" : "s"} need review. Statuses are updated manually.`;
        document.getElementById("summaryRunDate").textContent = "Manual status";
        document.getElementById("summaryRecommendations").textContent =
            `${failed} failed case${failed === 1 ? "" : "s"} should be triaged and retested after fixes. ${pending ? `Review the ${pending} pending case${pending === 1 ? "" : "s"} manually.` : "All test cases have a manually recorded status."}`;
    } else if (pending) {
        title.textContent = "Testing is in progress";
        text.textContent = `${passed} passed so far; ${pending} test case${pending === 1 ? "" : "s"} remain pending.`;
        document.getElementById("summaryRunDate").textContent = "Manual status";
        document.getElementById("summaryRecommendations").textContent =
            `Manually execute and update the ${pending} pending case${pending === 1 ? "" : "s"} before drawing release conclusions.`;
    } else {
        title.textContent = "All recorded test cases passed";
        text.textContent = "All generated cases currently have a Pass status. Statuses are manually maintained.";
        document.getElementById("summaryRunDate").textContent = "Manual status";
        document.getElementById("summaryRecommendations").textContent =
            "Review coverage against the latest requirements and update or regenerate cases when requirements change.";
    }
    renderSummaryStatusChart(total, passed, failed, pending);
    renderActivityChart(cases);
}

function renderSummaryStatusChart(total, passed, failed, pending) {
    const chart = document.getElementById("summaryStatusChart");
    if (!total) {
        chart.innerHTML = '<p class="no-results">A chart will appear after test cases are generated.</p>';
        return;
    }
    const categories = [["Pass", passed, "legend-violet"], ["Fail", failed, "legend-pink"], ["Pending", pending, "legend-amber"]];
    chart.innerHTML = categories.map(([label, count, colorClass]) => {
        const height = Math.max(count ? 5 : 0, Math.round((count / total) * 100));
        const barColor = colorClass === "legend-violet" ? "#a478f4" : colorClass === "legend-pink" ? "#eb718e" : "#dda958";
        return `<div class="bar-column"><div><i style="height:${height}%;background:${barColor}"></i></div><small>${label} · ${count}</small></div>`;
    }).join("");
}

function renderActivityChart(cases) {
    const container = document.getElementById("dashboardActivityChart");
    const days = document.getElementById("activityDays");
    const svg = document.getElementById("activitySvg");
    const now = new Date();
    const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (6 - index));
        date.setHours(0, 0, 0, 0);
        return date;
    });
    const recent = cases.filter(test => test.statusUpdatedAt && ["Pass", "Fail", "Passed", "Failed"].includes(test.executionStatus));
    if (!recent.length) {
        container.hidden = true;
        let empty = document.getElementById("dashboardActivityEmpty");
        if (!empty) {
            empty = document.createElement("p");
            empty.id = "dashboardActivityEmpty";
            empty.className = "no-results";
            container.parentNode.appendChild(empty);
        }
        empty.textContent = "Manual test status updates will appear here.";
        return;
    }
    container.hidden = false;
    document.getElementById("dashboardActivityEmpty")?.remove();
    const passed = dates.map(date => recent.filter(test => {
        const changed = new Date(test.statusUpdatedAt);
        return changed.toDateString() === date.toDateString() && ["Pass", "Passed"].includes(test.executionStatus);
    }).length);
    const failed = dates.map(date => recent.filter(test => {
        const changed = new Date(test.statusUpdatedAt);
        return changed.toDateString() === date.toDateString() && ["Fail", "Failed"].includes(test.executionStatus);
    }).length);
    const maximum = Math.max(1, ...passed, ...failed);
    const toPath = values => values.map((value, index) =>
        `${index ? "L" : "M"}${(index * 700) / 6} ${175 - (value / maximum) * 155}`).join(" ");
    const areaPath = `${toPath(passed)} L700 190 L0 190 Z`;
    svg.innerHTML = `<defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity=".28"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="${areaPath}"/><path class="chart-line" d="${toPath(passed)}"/><path class="chart-muted-line" d="${toPath(failed)}"/>`;
    days.innerHTML = dates.map(date => `<span>${date.toLocaleDateString(undefined, { weekday: "short" })}</span>`).join("");
    document.querySelectorAll(".chart-y-labels span").forEach((label, index) => {
        label.textContent = Math.ceil(maximum * (1 - index / 4));
    });
}

const historySearch = document.getElementById("historySearch");
const historyFilter = document.getElementById("historyFilter");

function renderHistory() {
    const records = getRecords();
    const tbody = document.getElementById("historyRows");
    tbody.innerHTML = records.map(record => {
        const type = historyTypes[record.type] || record.type;
        const iconClass = record.type === "bug" ? "pink-icon" : record.type === "testcases" ? "blue-icon" : "violet-icon";
        const icon = record.type === "bug" ? "⚑" : record.type === "testcases" ? "▤" : record.type === "analysis" ? "⌕" : "✦";
        const resultSummary = summarizeInput(record);
        return `<tr data-record-id="${escapeHtml(record.id)}" data-type="${escapeHtml(record.type)}" data-search="${escapeHtml(JSON.stringify({ title: record.title, input: record.input, type }))}">
            <td><div class="history-name"><span class="activity-symbol ${iconClass}">${icon}</span><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(resultSummary || "Generated QA result")}</small></span></div></td>
            <td>${escapeHtml(type)}</td><td>${escapeHtml(formatDate(record.createdAt))}</td>
            <td><span class="status-badge ${record.legacy ? "draft" : "completed"}">${record.legacy ? "Details unavailable" : "Saved"}</span></td>
            <td><button class="icon-button row-action open-record" aria-label="Open record">↗</button><button class="icon-button row-action delete-record" aria-label="Delete record">×</button></td>
        </tr>`;
    }).join("");
    filterHistory();
}

function filterHistory() {
    const query = historySearch.value.trim().toLowerCase();
    const type = historyFilter.value;
    const rows = Array.from(document.querySelectorAll("#historyRows tr"));
    let visibleCount = 0;
    rows.forEach(row => {
        const searchableText = `${row.textContent} ${row.dataset.search || ""}`.toLowerCase();
        const matches = (type === "all" || row.dataset.type === type) && searchableText.includes(query);
        row.hidden = !matches;
        if (matches) visibleCount++;
    });
    document.getElementById("historyCount").textContent = `Showing ${visibleCount} ${visibleCount === 1 ? "activity" : "activities"}`;
    const empty = document.getElementById("noHistoryResults");
    empty.hidden = visibleCount > 0;
    empty.textContent = rows.length ? "No matching activity found." : "No saved activity yet. Generated results will appear here.";
}
historySearch.addEventListener("input", filterHistory);
historyFilter.addEventListener("change", filterHistory);

function openRecord(record) {
    document.getElementById("recordModal")?.remove();
    const backdrop = document.createElement("div");
    backdrop.id = "recordModal";
    backdrop.setAttribute("role", "presentation");
    Object.assign(backdrop.style, {
        position: "fixed", inset: "0", zIndex: "30", display: "grid", placeItems: "center",
        padding: "20px", background: "#05040ddd", backdropFilter: "blur(5px)"
    });
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", record.title);
    Object.assign(panel.style, {
        width: "min(760px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column",
        borderColor: "#3d3151", background: "#11101b", boxShadow: "0 25px 80px #000b"
    });
    const header = document.createElement("div");
    header.className = "panel-heading";
    const title = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = record.title;
    const detail = document.createElement("p");
    detail.textContent = `${historyTypes[record.type] || record.type} · ${formatDate(record.createdAt)}`;
    title.append(heading, detail);
    const close = document.createElement("button");
    close.className = "secondary-btn";
    close.textContent = "Close";
    close.addEventListener("click", () => backdrop.remove());
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const copy = document.createElement("button");
    copy.className = "secondary-btn";
    copy.textContent = "Copy";
    copy.addEventListener("click", () => copyText(content.textContent, "Saved result"));
    actions.append(copy, close);
    header.append(title, actions);
    const content = document.createElement("pre");
    content.textContent = formatResultText(record.type, record.result);
    Object.assign(content.style, {
        overflow: "auto", margin: "15px 0 0", padding: "14px", border: "1px solid #302b42",
        borderRadius: "8px", background: "#0d0c15", color: "#d0cad8",
        font: "10px/1.8 'DM Sans', sans-serif", whiteSpace: "pre-wrap", overflowWrap: "anywhere"
    });
    panel.append(header, content);
    backdrop.appendChild(panel);
    backdrop.addEventListener("click", event => {
        if (event.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
    close.focus();
}

document.getElementById("historyRows").addEventListener("click", event => {
    const row = event.target.closest("tr[data-record-id]");
    if (!row) return;
    try {
        const records = getRecords();
        const record = records.find(item => item.id === row.dataset.recordId);
        if (!record) throw new Error("This saved record could not be found.");
        if (event.target.closest(".open-record")) openRecord(record);
        if (event.target.closest(".delete-record")) {
            if (!window.confirm(`Delete "${record.title}" from history?`)) return;
            writeRecords(records.filter(item => item.id !== record.id));
            refreshDataViews();
            showToast("Saved record deleted.");
        }
    } catch (error) {
        showApiError(error);
    }
});

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    if (!window.confirm("Clear all saved TestPilot activity from this browser?")) return;
    try {
        writeRecords([]);
        localStorage.removeItem(LEGACY_HISTORY_KEY);
        refreshDataViews();
        showToast("All saved activity has been cleared.");
    } catch (error) {
        showApiError(error);
    }
});

function refreshDataViews() {
    renderHistory();
    renderDashboard();
    renderTestSummary();
    renderLatestTestCases();
}

function renderDashboard() {
    let records;
    let cases;
    try {
        records = getRecords();
        cases = allTestCases(records);
    } catch (error) {
        console.error("Unable to refresh dashboard:", error);
        return;
    }
    const currentRecords = records.filter(record => !record.legacy);
    const requirements = currentRecords.filter(record => record.type === "analysis").length;
    const generatedCases = cases.filter(test => !test.legacy).length;
    const bugs = currentRecords.filter(record => record.type === "bug").length;
    const passed = cases.filter(test => ["Pass", "Passed"].includes(test.executionStatus)).length;
    const failed = cases.filter(test => ["Fail", "Failed"].includes(test.executionStatus)).length;
    const passRate = generatedCases ? Math.round((passed / generatedCases) * 100) : 0;
    document.getElementById("dashboardRequirements").innerHTML = `${requirements} <small>total</small>`;
    document.getElementById("dashboardTestCases").innerHTML = `${generatedCases} <small>total</small>`;
    document.getElementById("dashboardBugs").innerHTML = `${bugs} <small>total</small>`;
    document.getElementById("dashboardPassRate").innerHTML = `${passRate}<small>%</small>`;
    renderMetricBars(records, cases);

    const recent = document.getElementById("dashboardRecentActivity");
    if (!records.length) {
        recent.innerHTML = '<p class="no-results">Generated work will appear here.</p>';
    } else {
        const recentRecords = currentRecords.slice(0, 4);
        recent.innerHTML = recentRecords.length ? recentRecords.map(record => {
            const icon = record.type === "bug" ? "⚑" : record.type === "testcases" ? "▤" : record.type === "analysis" ? "⌕" : "✦";
            const iconClass = record.type === "bug" ? "pink-icon" : record.type === "testcases" ? "blue-icon" : "violet-icon";
            return `<div class="activity-item"><span class="activity-symbol ${iconClass}">${icon}</span><div><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(historyTypes[record.type] || record.type)}</small></div><time>${escapeHtml(formatDate(record.createdAt))}</time></div>`;
        }).join("") : '<p class="no-results">Newly generated results will appear here.</p>';
    }
    renderActivityChart(cases);
}

function renderMetricBars(records, cases) {
    const now = new Date();
    document.querySelectorAll(".mini-bars[data-mini]").forEach(bars => {
        const type = bars.dataset.mini;
        const values = Array.from({ length: 12 }, (_, index) => {
            const date = new Date(now);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (11 - index));
            if (type === "passrate") {
                return cases.filter(test => ["Pass", "Passed"].includes(test.executionStatus) && test.statusUpdatedAt &&
                    new Date(test.statusUpdatedAt).toDateString() === date.toDateString()).length;
            }
            return records.filter(record => record.type === type &&
                new Date(record.createdAt).toDateString() === date.toDateString()).length;
        });
        const max = Math.max(1, ...values);
        Array.from(bars.children).forEach((bar, index) => {
            bar.style.height = `${values[index] ? Math.max(12, (values[index] / max) * 100) : 0}%`;
        });
    });
}

function setSettingsStatus(label, description, configured) {
    document.getElementById("apiStatusLabel").textContent = label;
    document.getElementById("apiStatusLabel").classList.toggle("green-icon", configured);
    document.getElementById("apiStatusLabel").classList.toggle("amber-icon", !configured);
    document.getElementById("apiStatusDescription").textContent = description;
}

async function checkApiStatus() {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/health`);
        if (!response.ok) throw new Error("Backend health check failed.");
        const data = await response.json();
        if (data.geminiConfigured) {
            setSettingsStatus("Key configured", "Backend is reachable and a Gemini key is configured. This confirms configuration only; it does not test Gemini quota or model access.", true);
        } else {
            setSettingsStatus("Key missing", "Backend is reachable, but Gemini requests need GEMINI_API_KEY in backend/.env.", false);
        }
    } catch (error) {
        setSettingsStatus("Backend offline", "Start the backend with `npm start` to enable API features.", false);
    }
}

document.querySelectorAll(".settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".settings-tab").forEach(item => item.classList.toggle("active", item === tab));
        document.querySelectorAll(".settings-section").forEach(section => {
            section.classList.toggle("active", section.id === `settings-${tab.dataset.settings}`);
        });
    });
});
document.getElementById("saveProfileBtn").addEventListener("click", () => {
    const profile = {
        name: document.getElementById("profileName").value.trim(),
        email: document.getElementById("profileEmail").value.trim()
    };
    if (!profile.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        showToast("Enter a name and a valid email address.");
        return;
    }
    try {
        localStorage.setItem("testpilotProfile", JSON.stringify(profile));
        document.querySelector(".top-user-copy strong").textContent = profile.name;
        const initials = profile.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
        document.querySelector(".profile-avatar").textContent = initials;
        document.querySelector(".top-user .avatar").textContent = initials;
        document.querySelector(".sidebar-user strong").textContent = profile.name;
        document.querySelector(".sidebar-user .avatar").textContent = initials;
        showToast("Profile details saved in this browser.");
    } catch (error) {
        showApiError(new Error("Profile could not be saved in browser storage."));
    }
});
document.getElementById("savePreferencesBtn").addEventListener("click", () => {
    try {
        localStorage.setItem("testpilotPreferences", JSON.stringify({
            priority: document.getElementById("defaultPriority").value
        }));
        showToast("Preferences saved in this browser.");
    } catch (error) {
        showApiError(new Error("Preferences could not be saved in browser storage."));
    }
});
function loadSettings() {
    try {
        const profile = JSON.parse(localStorage.getItem("testpilotProfile") || "null");
        if (profile) {
            document.getElementById("profileName").value = profile.name || "";
            document.getElementById("profileEmail").value = profile.email || "";
            if (profile.name) {
                document.querySelector(".top-user-copy strong").textContent = profile.name;
                const initials = profile.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
                document.querySelector(".profile-avatar").textContent = initials;
                document.querySelector(".top-user .avatar").textContent = initials;
                document.querySelector(".sidebar-user strong").textContent = profile.name;
                document.querySelector(".sidebar-user .avatar").textContent = initials;
            }
        }
        const preferences = JSON.parse(localStorage.getItem("testpilotPreferences") || "null");
        if (preferences) {
            document.getElementById("defaultPriority").value = preferences.priority || "Medium";
        }
        document.getElementById("apiBaseUrl").value = localStorage.getItem("testpilotApiBaseUrl") || "http://localhost:5000";
    } catch (error) {
        console.error("Unable to load saved settings:", error);
        showToast("Saved settings could not be loaded from browser storage.");
    }
}
document.getElementById("saveApiSettingsBtn").addEventListener("click", () => {
    try {
        const input = document.getElementById("apiBaseUrl").value.trim();
        if (input) {
            const parsed = new URL(input);
            if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
                throw new Error("Enter only a backend HTTP(S) origin, such as http://localhost:5000.");
            }
        }
        localStorage.setItem("testpilotApiBaseUrl", input.replace(/\/+$/, ""));
        showToast("Backend URL saved. Checking connection...");
        checkApiStatus();
    } catch (error) {
        showToast(error.message || "Backend URL could not be saved.");
    }
});

async function initialize() {
    loadSettings();
    checkApiStatus();
    try {
        renderHistory();
        renderDashboard();
        renderTestSummary();
        renderLatestTestCases();
    } catch (error) {
        console.error("Unable to load TestPilot data:", error);
        showToast(error.message);
    }
    showPage("dashboard");
}

initialize();
