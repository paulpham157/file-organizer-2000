'use client'
import * as React from "react";
import { FileList } from "./_components/FileList";
import { UploadCloud, RefreshCw, Clock, CheckCircle } from "lucide-react";

export default function SyncDashboard() {
  return (
    <div className="container max-w-6xl mx-auto p-6">
      <style jsx global>{`
        .markdown-body {
          color: #24292e;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.6;
        }
        
        .markdown-body h1 {
          font-size: 2em;
          margin-top: 0.67em;
          margin-bottom: 0.67em;
          font-weight: 600;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        
        .markdown-body h2 {
          font-size: 1.5em;
          margin-top: 1em;
          margin-bottom: 1em;
          font-weight: 600;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        
        .markdown-body h3 {
          font-size: 1.25em;
          margin-top: 1em;
          margin-bottom: 1em;
          font-weight: 600;
        }
        
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
          margin-top: 1em;
          margin-bottom: 1em;
          font-weight: 600;
        }
        
        .markdown-body ul, .markdown-body ol {
          margin-bottom: 1em;
          padding-left: 2em;
        }
        
        .markdown-body ul {
          list-style-type: disc;
        }
        
        .markdown-body ol {
          list-style-type: decimal;
        }
        
        .markdown-body li {
          margin: 0.25em 0;
        }
        
        .markdown-body blockquote {
          padding: 0 1em;
          color: #6a737d;
          border-left: 0.25em solid #dfe2e5;
          margin: 1em 0;
        }
        
        .markdown-body pre {
          background-color: #f6f8fa;
          border-radius: 3px;
          padding: 16px;
          overflow: auto;
          margin-bottom: 1em;
        }
        
        .markdown-body code {
          font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
          padding: 0.2em 0.4em;
          background-color: rgba(27, 31, 35, 0.05);
          border-radius: 3px;
          font-size: 85%;
        }
        
        .markdown-body pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
        }
        
        .markdown-body a {
          color: #0366d6;
          text-decoration: none;
        }
        
        .markdown-body a:hover {
          text-decoration: underline;
        }
        
        .markdown-body table {
          border-collapse: collapse;
          margin: 1em 0;
          overflow: auto;
          width: 100%;
        }
        
        .markdown-body table th, .markdown-body table td {
          padding: 6px 13px;
          border: 1px solid #dfe2e5;
        }
        
        .markdown-body table tr {
          background-color: #fff;
          border-top: 1px solid #c6cbd1;
        }
        
        .markdown-body table tr:nth-child(2n) {
          background-color: #f6f8fa;
        }
        
        .markdown-body hr {
          height: 0.25em;
          padding: 0;
          margin: 24px 0;
          background-color: #e1e4e8;
          border: 0;
        }
        
        .markdown-body img {
          max-width: 100%;
        }
        
        .markdown-body p {
          margin-bottom: 1em;
        }
      `}</style>
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <header>
          <div className="flex items-center">
            <UploadCloud className="h-6 w-6 mr-2 text-blue-600" />
            <h1 className="text-2xl font-bold">Note Companion Sync</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            View, organize, and manage your uploaded files
          </p>
        </header>
        
        <div className="flex flex-wrap gap-4 bg-slate-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <RefreshCw className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Simple Sync</p>
              <p className="text-xs text-muted-foreground">Fast & reliable</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-full">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Auto Updates</p>
              <p className="text-xs text-muted-foreground">Real-time status</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-full">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Organized</p>
              <p className="text-xs text-muted-foreground">Sort & filter</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <FileList />
      </div>
    </div>
  );
}
