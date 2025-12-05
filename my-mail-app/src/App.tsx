import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Inbox, 
  Briefcase, 
  Bell, 
  Calendar, 
  DollarSign, 
  Plane, 
  Headphones, 
  Newspaper, 
  User, 
  FileText, 
  Megaphone, 
  AlertOctagon,
  Menu,
  Search,
  CheckCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';

// --- Types ---

interface Email {
  id: string;
  sender: string;
  subject: string;
  body: string;
  folder: string;
  timestamp: Date;
  isRead: boolean;
  allLabels?: string[]; // Store all classification labels
}

interface ClassifyResponse {
  primary_classification: "Spam" | "No-Spam";
  detailed_labels: string[];
}

// --- Constants ---

const API_URL = "http://0.0.0.0:9090/classify";

const FOLDERS = [
  { id: 'Inbox', icon: Inbox, color: 'text-gray-600' }, // Default bucket for unclassified
  { id: 'Business', icon: Briefcase, color: 'text-blue-600' },
  { id: 'Reminders', icon: Bell, color: 'text-yellow-600' },
  { id: 'Events & Invitations', icon: Calendar, color: 'text-purple-600' },
  { id: 'Finance & Bills', icon: DollarSign, color: 'text-green-600' },
  { id: 'Travel & Bookings', icon: Plane, color: 'text-sky-600' },
  { id: 'Customer Support', icon: Headphones, color: 'text-orange-600' },
  { id: 'Newsletters', icon: Newspaper, color: 'text-indigo-600' },
  { id: 'Personal', icon: User, color: 'text-teal-600' },
  { id: 'Job Application', icon: FileText, color: 'text-slate-600' },
  { id: 'Promotions', icon: Megaphone, color: 'text-pink-600' },
  { id: 'Spam', icon: AlertOctagon, color: 'text-red-600' },
];

// --- Mock Data Generator (for fallback) ---
const mockClassify = (text: string): Promise<ClassifyResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('win') || lowerText.includes('lottery') || lowerText.includes('verify your account')) {
        resolve({ primary_classification: "Spam", detailed_labels: [] });
      } else if (lowerText.includes('invoice') || lowerText.includes('payment')) {
        resolve({ primary_classification: "No-Spam", detailed_labels: ['Finance & Bills'] });
      } else if (lowerText.includes('meeting') || lowerText.includes('agenda')) {
        resolve({ primary_classification: "No-Spam", detailed_labels: ['Business'] });
      } else if (lowerText.includes('flight') || lowerText.includes('hotel')) {
        resolve({ primary_classification: "No-Spam", detailed_labels: ['Travel & Bookings'] });
      } else {
        resolve({ primary_classification: "No-Spam", detailed_labels: ['Personal'] });
      }
    }, 1500);
  });
};

export default function App() {
  const [activeFolder, setActiveFolder] = useState<string>('Compose');
  const [emails, setEmails] = useState<Email[]>([]);
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastClassification, setLastClassification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stats for sidebar
  const getCount = (folderId: string) => emails.filter(e => e.folder === folderId).length;

  const handleSend = async () => {
    if (!composeBody.trim()) return;

    setIsSending(true);
    setErrorMsg(null);
    setLastClassification(null);

    let targetFolder = 'Inbox';
    let allLabels: string[] = [];

    try {
      // 1. Attempt Real API Call
      // Note: This might fail in a browser sandbox due to Mixed Content (HTTPS -> HTTP) 
      // or CORS if the python server isn't configured to accept requests from this origin.
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_text: composeBody }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data: ClassifyResponse = await response.json();
      
      if (data.primary_classification === 'Spam') {
        targetFolder = 'Spam';
        allLabels = ['Spam'];
      } else if (data.detailed_labels && data.detailed_labels.length > 0) {
        // Sort to the first label
        targetFolder = data.detailed_labels[0];
        // Store all labels for display
        allLabels = data.detailed_labels;
      } else {
        targetFolder = 'Personal';
        allLabels = ['Personal'];
      }

    } catch (error) {
      console.warn("API Call failed (likely due to CORS/Mixed Content in demo env). Using Mock classification.", error);
      setErrorMsg("Local API unreachable. Used internal mock for demonstration.");
      
      // Fallback to mock logic for demo purposes
      const mockData = await mockClassify(composeBody);
      if (mockData.primary_classification === 'Spam') {
        targetFolder = 'Spam';
        allLabels = ['Spam'];
      } else {
        targetFolder = mockData.detailed_labels[0] || 'Personal';
        allLabels = mockData.detailed_labels.length > 0 ? mockData.detailed_labels : ['Personal'];
      }
    }

    // 2. Create the email object
    const newEmail: Email = {
      id: Math.random().toString(36).substring(2, 11),
      sender: 'me@university.edu',
      subject: composeBody.slice(0, 30) + (composeBody.length > 30 ? '...' : ''),
      body: composeBody,
      folder: targetFolder,
      timestamp: new Date(),
      isRead: false,
      allLabels: allLabels
    };

    // 3. Update State
    setEmails(prev => [newEmail, ...prev]);
    setLastClassification(targetFolder);
    setComposeBody('');
    setIsSending(false);
    
    // 4. Navigate to the folder where it landed so user can see it
    setTimeout(() => {
      setActiveFolder(targetFolder);
    }, 1000);
  };

  const ActiveIcon = FOLDERS.find(f => f.id === activeFolder)?.icon || Mail;

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-hidden">
      
      {/* --- Sidebar --- */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Mail size={20} />
          </div>
          <span className="font-bold text-lg text-gray-800">Mailsense</span>
        </div>

        <div className="p-4">
          <button
            onClick={() => setActiveFolder('Compose')}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl transition-all shadow-sm ${
              activeFolder === 'Compose' 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Send size={18} />
            <span className="font-medium">Compose</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Folders
          </div>
          {FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const count = getCount(folder.id);
            const isActive = activeFolder === folder.id;
            
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={18} className={isActive ? 'text-blue-600' : folder.color} />
                  <span className="truncate max-w-[120px]">{folder.id}</span>
                </div>
                {count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <ActiveIcon size={24} className="text-gray-500" />
            <h1 className="text-xl font-semibold text-gray-800">{activeFolder}</h1>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search mail..." 
              className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          
          {/* View: Compose */}
          {activeFolder === 'Compose' && (
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="font-semibold text-gray-700">New Message</span>
                {lastClassification && (
                  <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium animate-pulse">
                    <CheckCircle size={14} />
                    <span>Sorted into: {lastClassification}</span>
                  </div>
                )}
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                  <input type="text" disabled value="classifier-bot@university.edu" className="w-full text-sm p-2 border-b border-gray-200 focus:outline-none bg-transparent text-gray-500" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Message Content</label>
                  <textarea 
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Type your email here. The AI will read this and sort it automatically..."
                    className="w-full h-64 p-4 text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                   <div className="text-xs text-gray-400 italic">
                     *Connects to http://0.0.0.0:9090/classify
                   </div>
                  <button 
                    onClick={handleSend}
                    disabled={isSending || !composeBody.trim()}
                    className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all shadow-md ${
                      isSending || !composeBody.trim()
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform active:scale-95'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Classifying...</span>
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Send & Classify</span>
                      </>
                    )}
                  </button>
                </div>
                
                {errorMsg && (
                   <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2 text-yellow-700 text-sm">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{errorMsg}</span>
                   </div>
                )}
              </div>
            </div>
          )}

          {/* View: Folder Lists */}
          {activeFolder !== 'Compose' && (
            <div className="max-w-4xl mx-auto space-y-4">
              {emails.filter(e => e.folder === activeFolder).length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <ActiveIcon size={40} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-600">No emails in {activeFolder}</h3>
                  <p className="text-gray-400 text-sm mt-1">Go to "Compose" to generate new emails.</p>
                </div>
              ) : (
                emails
                  .filter(e => e.folder === activeFolder)
                  .map((email) => (
                    <div key={email.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            ME
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800 text-sm">Me (User)</h4>
                            <span className="text-xs text-gray-500">to classifier-bot</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          {email.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="pl-10">
                        <h5 className="font-medium text-gray-800 mb-1">{email.subject}</h5>
                        <p className="text-gray-600 text-sm line-clamp-2">{email.body}</p>
                      </div>
                      <div className="mt-3 pl-10 flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          AI Tag: {email.allLabels && email.allLabels.length > 1 
                            ? `${email.allLabels[0]} (also: ${email.allLabels.slice(1).join(', ')})`
                            : email.folder}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}