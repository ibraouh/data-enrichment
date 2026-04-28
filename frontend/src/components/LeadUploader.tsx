"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, UserPlus, Sheet, Loader2, AlertCircle, ArrowRight, Copy, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getServiceAccountEmail, linkGoogleSheet, parseLeadsFromCSV, parseLeadsFromFile, parseLeadsSingle } from "@/lib/api";
import type { ParseLeadsResponse, RawLead } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeadUploaderProps {
  onSuccess: (response: ParseLeadsResponse) => void;
}

const CSV_PLACEHOLDER = `name,email,company,property_address,city,state,country
Sarah Chen,sarah@greystar.com,Greystar Real Estate,2500 Market St,San Francisco,CA,USA
Marcus Williams,m.williams@eqr.com,Equity Residential,400 N Michigan Ave,Chicago,IL,USA`;

const EMPTY_LEAD: RawLead = {
  name: "", email: "", company: "",
  property_address: "", city: "", state: "", country: "USA",
};

// ---------------------------------------------------------------------------
// Upload File Tab
// ---------------------------------------------------------------------------

function FileUploadTab({ onSuccess }: LeadUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError("Only .csv and .xlsx files are supported.");
      return;
    }
    setFile(f);
    setError(null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseLeadsFromFile(file);
      if (result.total === 0) {
        setError("No valid leads found in the file. Check the column names match the expected format.");
        return;
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/10"
            : file
            ? "border-emerald-400 bg-emerald-50"
            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <>
            <FileText className="w-8 h-8 text-emerald-600" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024).toFixed(1)} KB · Click to replace
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Drop your file here</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                .csv or .xlsx · or click to browse
              </p>
            </div>
          </>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <Button onClick={handleSubmit} disabled={!file || loading} className="w-full font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : <>Parse Leads <ArrowRight className="w-4 h-4" /></>}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paste CSV Tab
// ---------------------------------------------------------------------------

function PasteCSVTab({ onSuccess }: LeadUploaderProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseLeadsFromCSV(value);
      if (result.total === 0) {
        setError("No valid leads found. Check column names match the expected format.");
        return;
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={CSV_PLACEHOLDER}
        className="font-mono text-xs min-h-[200px] leading-relaxed"
        spellCheck={false}
      />
      {error && <ErrorBanner message={error} />}
      <Button onClick={handleSubmit} disabled={!value.trim() || loading} className="w-full font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : <>Parse Leads <ArrowRight className="w-4 h-4" /></>}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Lead Tab
// ---------------------------------------------------------------------------

const SINGLE_FIELDS: { key: keyof RawLead; label: string; placeholder: string; required: boolean }[] = [
  { key: "name",             label: "Full Name",        placeholder: "Sarah Chen",           required: true },
  { key: "email",            label: "Email",            placeholder: "sarah@company.com",    required: true },
  { key: "company",          label: "Company",          placeholder: "Greystar Real Estate", required: true },
  { key: "property_address", label: "Property Address", placeholder: "2500 Market St",       required: true },
  { key: "city",             label: "City",             placeholder: "San Francisco",         required: true },
  { key: "state",            label: "State",            placeholder: "CA",                   required: true },
  { key: "country",          label: "Country",          placeholder: "USA",                  required: false },
];

function SingleLeadTab({ onSuccess }: LeadUploaderProps) {
  const [lead, setLead] = useState<RawLead>(EMPTY_LEAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof RawLead, value: string) {
    setLead((prev) => ({ ...prev, [key]: value }));
  }

  const isValid = SINGLE_FIELDS.filter((f) => f.required).every((f) => lead[f.key].trim());

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const result = await parseLeadsSingle(lead);
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SINGLE_FIELDS.map(({ key, label, placeholder, required }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>
              {label}{required && <span className="text-primary ml-0.5">*</span>}
            </Label>
            <Input
              id={key}
              value={lead[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
      {error && <ErrorBanner message={error} />}
      <Button onClick={handleSubmit} disabled={!isValid || loading} className="w-full font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <>Add Lead <ArrowRight className="w-4 h-4" /></>}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Sheet Tab
// ---------------------------------------------------------------------------

function GoogleSheetTab({ onSuccess }: LeadUploaderProps) {
  const [url, setUrl] = useState("");
  const [serviceEmail, setServiceEmail] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getServiceAccountEmail()
      .then((r) => setServiceEmail(r.email))
      .catch(() => setServiceEmail(null))
      .finally(() => setEmailLoading(false));
  }, []);

  async function copyEmail() {
    if (!serviceEmail) return;
    await navigator.clipboard.writeText(serviceEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await linkGoogleSheet(url.trim());
      if (result.total === 0) {
        setError("No valid leads found in the sheet. Check that column names match the expected format.");
        return;
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link sheet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Instruction card */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Before linking, share your sheet:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Open your Google Sheet and click <span className="font-medium text-foreground">Share</span> (top right)</li>
          <li>Add the address below with <span className="font-medium text-foreground">Viewer</span> access</li>
          <li>Paste your sheet URL below and click <span className="font-medium text-foreground">Link Sheet</span></li>
        </ol>
        <div className="flex items-center gap-2">
          {emailLoading ? (
            <div className="flex-1 h-8 rounded-lg bg-muted animate-pulse" />
          ) : serviceEmail ? (
            <>
              <code className="flex-1 text-xs font-mono bg-background border border-border rounded-lg px-3 py-1.5 truncate select-all">
                {serviceEmail}
              </code>
              <button
                onClick={copyEmail}
                className="shrink-0 p-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                title="Copy email"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-full">
              Google Sheets not configured — set GOOGLE_SERVICE_ACCOUNT_JSON in .env
            </p>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-1.5">
        <Label htmlFor="sheet-url">Google Sheet URL</Label>
        <Input
          id="sheet-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          disabled={!serviceEmail}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <Button
        onClick={handleSubmit}
        disabled={!url.trim() || !serviceEmail || loading}
        className="w-full font-semibold"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Linking…</>
          : <>Link Sheet <ArrowRight className="w-4 h-4" /></>}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared error banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-600">
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LeadUploader({ onSuccess }: LeadUploaderProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <Tabs defaultValue="file">
        <TabsList className="mb-1">
          <TabsTrigger value="file" className="flex items-center gap-1.5 flex-1">
            <Upload className="w-3.5 h-3.5" /> Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex items-center gap-1.5 flex-1">
            <FileText className="w-3.5 h-3.5" /> Paste CSV
          </TabsTrigger>
          <TabsTrigger value="single" className="flex items-center gap-1.5 flex-1">
            <UserPlus className="w-3.5 h-3.5" /> Add Single
          </TabsTrigger>
          <TabsTrigger value="sheet" className="flex items-center gap-1.5 flex-1">
            <Sheet className="w-3.5 h-3.5" /> Google Sheet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <FileUploadTab onSuccess={onSuccess} />
        </TabsContent>
        <TabsContent value="paste">
          <PasteCSVTab onSuccess={onSuccess} />
        </TabsContent>
        <TabsContent value="single">
          <SingleLeadTab onSuccess={onSuccess} />
        </TabsContent>
        <TabsContent value="sheet">
          <GoogleSheetTab onSuccess={onSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
