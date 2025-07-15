"use client";
import React, { useState, useCallback, useMemo } from 'react';
import { Upload, Users, AlertTriangle, TrendingUp, FileText, Award, UserCheck, School, MapPin, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Add types for file data
interface FellowsTrackerSheet {
  [sheetName: string]: any[][];
}

interface Fellow {
  id: number;
  firstName: string;
  surname: string;
  fullName: string;
  gender: string;
  phone: string;
  email: string;
  fellowshipId: string;
  uniqueId: string;
  fellowshipPath: string;
  cohort: string;
  state: string;
  school: string;
  coach: string;
  captured: string;
  resumptionDate: string;
  status: string;
  monthlyData: { [month: string]: {
    weeklyScores: number[];
    monthlyTotal: number;
    monthlyAverage: number;
    paymentCleared: boolean;
  }};
  totalSessions: number;
  averageScore: number;
  riskLevel: string;
  paymentStatus: { [month: string]: boolean };
  attendanceRate: number;
}

interface Coach {
  name: string;
  fellows: Fellow[];
  totalFellows: number;
  riskDistribution: { high: number; medium: number; low: number };
}

interface Analysis {
  fellows: Fellow[];
  coaches: { [coach: string]: Coach };
  states: { [state: string]: number };
  schools: { [school: string]: number };
  fellowshipPaths: { [path: string]: number };
  genderCount: { [gender: string]: number };
  totalFellows: number;
  riskCounts: { high: number; medium: number; low: number };
  paymentIssues: number;
}

interface ObservationRow {
  [key: string]: any;
}

interface ObservationFellow {
  name: string;
  region: string;
  school: string;
  subject: string;
  observer: string;
  scores: number[];
  warningCount: number;
  warningDetails: string[];
  sessionCount: number;
  dominantMindset: string;
  classRange: string;
  avgScore?: number;
  riskLevel?: string;
}

interface ObservationAnalysis {
  fellows: { [name: string]: ObservationFellow };
  observers: { [observer: string]: number };
  regions: { [region: string]: number };
  rubricAreas: string[];
  stakeholderAreas: string[];
  allAreas: string[];
  holisticOutcomes: { [outcome: string]: number };
  leadershipMindsets: { [mindset: string]: number };
  scoreDistributions: { [area: string]: { [score: number]: number } };
}

const FellowsTrackerDashboard = () => {
  const [fellowsTrackerData, setFellowsTrackerData] = useState<FellowsTrackerSheet | null>(null);
  const [observationData, setObservationData] = useState<ObservationRow[] | null>(null);
  const [personalizedData, setPersonalizedData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean[]>([false, false, false]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('fellows-tracker');

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: 'fellows-tracker' | 'observation' | 'personalized'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileIndex = fileType === 'fellows-tracker' ? 0 : fileType === 'observation' ? 1 : 2;
    setLoading(prev => {
      const newLoading = [...prev];
      newLoading[fileIndex] = true;
      return newLoading;
    });
    setError(null);

    try {
      const fileData = await file.arrayBuffer();
      let parsedData: any;

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(fileData);
        if (fileType === 'fellows-tracker') {
          // Parse Fellows Tracker with all sheets
          const allSheetsData: FellowsTrackerSheet = {};
          workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
            allSheetsData[sheetName] = sheetData;
          });
          parsedData = allSheetsData;
        } else {
          // Parse other files normally
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        }
      } else if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(fileData);
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
      } else {
        throw new Error('Please upload an Excel (.xlsx) or CSV file');
      }

      // Set data based on file type
      if (fileType === 'fellows-tracker') {
        setFellowsTrackerData(parsedData as FellowsTrackerSheet);
      } else if (fileType === 'observation') {
        setObservationData(parsedData as ObservationRow[]);
      } else if (fileType === 'personalized') {
        setPersonalizedData(parsedData as any[]);
      }

    } catch (err: any) {
      setError(`Error processing ${fileType} file: ${err.message}`);
    } finally {
      setLoading(prev => {
        const newLoading = [...prev];
        newLoading[fileIndex] = false;
        return newLoading;
      });
    }
  };

  const analyzeFellowsTrackerData = useCallback((): Analysis | null => {
    if (!fellowsTrackerData || !fellowsTrackerData['All Fellows']) return null;

    const allFellowsSheet = fellowsTrackerData['All Fellows'] as any[][];
    
    // Skip header rows (first 3 rows), start from row 4 (index 3)
    const dataRows = allFellowsSheet.slice(3);
    
    const fellows: Fellow[] = [];
    const coaches: { [coach: string]: Coach } = {};
    const states: { [state: string]: number } = {};
    const schools: { [school: string]: number } = {};
    const fellowshipPaths: { [path: string]: number } = {};
    const genderCount: { [gender: string]: number } = { Male: 0, Female: 0, Unknown: 0 };
    
    // Column mapping based on analysis
    const FELLOW_INFO_COLUMNS = {
      firstName: 1,      // Column B
      surname: 2,        // Column C
      gender: 3,         // Column D
      phone: 4,          // Column E
      email: 5,          // Column F
      fellowshipId: 6,   // Column G
      uniqueId: 7,       // Column H
      fellowshipPath: 8, // Column I
      cohort: 9,         // Column J
      state: 10,         // Column K
      school: 11,        // Column L
      coach: 12,         // Column M
      captured: 13,      // Column N
      resumptionDate: 14, // Column O
      status: 15         // Column P
    };

    // Weekly tracking starts from column Q (index 16)
    const TRACKING_START_COLUMN = 16;
    const MONTH_BLOCK_SIZE = 6; // 5 weeks + 1 payment column
    const MONTHS = [
      'September 2022', 'October 2022', 'November 2022', 'December 2022',
      'January 2023', 'February 2023', 'March 2023', 'April 2023',
      'May 2023', 'June 2023', 'July 2023', 'August 2023', 'September 2023'
    ];

    dataRows.forEach((row, index) => {
      // Skip empty rows
      if (!row[FELLOW_INFO_COLUMNS.firstName] || row[FELLOW_INFO_COLUMNS.firstName].toString().trim() === '') {
        return;
      }

      const fellow: Fellow = {
        id: index,
        firstName: row[FELLOW_INFO_COLUMNS.firstName] || '',
        surname: row[FELLOW_INFO_COLUMNS.surname] || '',
        fullName: `${row[FELLOW_INFO_COLUMNS.firstName] || ''} ${row[FELLOW_INFO_COLUMNS.surname] || ''}`.trim(),
        gender: row[FELLOW_INFO_COLUMNS.gender] || 'Unknown',
        phone: row[FELLOW_INFO_COLUMNS.phone] || '',
        email: row[FELLOW_INFO_COLUMNS.email] || '',
        fellowshipId: row[FELLOW_INFO_COLUMNS.fellowshipId] || '',
        uniqueId: row[FELLOW_INFO_COLUMNS.uniqueId] || '',
        fellowshipPath: row[FELLOW_INFO_COLUMNS.fellowshipPath] || 'Unknown',
        cohort: row[FELLOW_INFO_COLUMNS.cohort] || '',
        state: row[FELLOW_INFO_COLUMNS.state] || 'Unknown',
        school: row[FELLOW_INFO_COLUMNS.school] || 'Unknown',
        coach: row[FELLOW_INFO_COLUMNS.coach] || 'Unknown',
        captured: row[FELLOW_INFO_COLUMNS.captured] || '',
        resumptionDate: row[FELLOW_INFO_COLUMNS.resumptionDate] || '',
        status: row[FELLOW_INFO_COLUMNS.status] || 'Unknown',
        monthlyData: {},
        totalSessions: 0,
        averageScore: 0,
        riskLevel: 'Low Risk',
        paymentStatus: {},
        attendanceRate: 0
      };

      // Analyze monthly tracking data
      let totalScores = 0;
      let totalWeeks = 0;
      let activeSessions = 0;

      MONTHS.forEach((month, monthIndex) => {
        const monthStartCol = TRACKING_START_COLUMN + (monthIndex * MONTH_BLOCK_SIZE);
        const weeklyScores: number[] = [];
        let monthlyTotal = 0;

        // Get weekly scores (5 weeks per month)
        for (let week = 0; week < 5; week++) {
          const weekCol = monthStartCol + week;
          const score = parseInt(row[weekCol]) || 0;
          weeklyScores.push(score);
          monthlyTotal += score;
          if (score > 0) activeSessions++;
          totalScores += score;
          totalWeeks++;
        }

        // Get payment status
        const paymentCol = monthStartCol + 5;
        const paymentStatus = row[paymentCol] || 'NO';

        fellow.monthlyData[month] = {
          weeklyScores,
          monthlyTotal,
          monthlyAverage: monthlyTotal / 5,
          paymentCleared: paymentStatus.toString().toUpperCase() === 'YES' || paymentStatus === 1
        };

        fellow.paymentStatus[month] = fellow.monthlyData[month].paymentCleared;
      });

      // Calculate metrics
      fellow.totalSessions = activeSessions;
      fellow.averageScore = totalWeeks > 0 ? totalScores / totalWeeks : 0;
      fellow.attendanceRate = (activeSessions / (13 * 5)) * 100; // 13 months × 5 weeks

      // Determine risk level based on attendance percentage
      // Total possible sessions = 13 months × 5 weeks = 65 sessions
      const totalPossibleSessions = 65;
      const attendancePercentage = (fellow.totalSessions / totalPossibleSessions) * 100;
      
      if (attendancePercentage < 40) {
        fellow.riskLevel = 'High Risk';
      } else if (attendancePercentage <= 50) {
        fellow.riskLevel = 'Medium Risk';
      } else {
        fellow.riskLevel = 'Low Risk';
      }

      fellows.push(fellow);

      // Update aggregations
      genderCount[fellow.gender] = (genderCount[fellow.gender] || 0) + 1;
      states[fellow.state] = (states[fellow.state] || 0) + 1;
      schools[fellow.school] = (schools[fellow.school] || 0) + 1;
      fellowshipPaths[fellow.fellowshipPath] = (fellowshipPaths[fellow.fellowshipPath] || 0) + 1;

      // Update coaches data
      if (!coaches[fellow.coach]) {
        coaches[fellow.coach] = {
          name: fellow.coach,
          fellows: [],
          totalFellows: 0,
          riskDistribution: { high: 0, medium: 0, low: 0 }
        };
      }
      coaches[fellow.coach].fellows.push(fellow);
      coaches[fellow.coach].totalFellows++;
      
      if (fellow.riskLevel === 'High Risk') coaches[fellow.coach].riskDistribution.high++;
      else if (fellow.riskLevel === 'Medium Risk') coaches[fellow.coach].riskDistribution.medium++;
      else coaches[fellow.coach].riskDistribution.low++;
    });

    return {
      fellows,
      coaches,
      states,
      schools,
      fellowshipPaths,
      genderCount,
      totalFellows: fellows.length,
      riskCounts: {
        high: fellows.filter(f => f.riskLevel === 'High Risk').length,
        medium: fellows.filter(f => f.riskLevel === 'Medium Risk').length,
        low: fellows.filter(f => f.riskLevel === 'Low Risk').length
      },
      paymentIssues: fellows.filter(f => Object.values(f.paymentStatus).includes(false)).length
    };
  }, [fellowsTrackerData]);

  // OBSERVATION DATA ANALYSIS FROM SECOND CODE
  const analyzeObservationData = useCallback((): ObservationAnalysis | null => {
    if (!observationData || observationData.length === 0) return null;

    const rubricAreas = [
      'Classroom Vision and Goals', 'Planning of Lesson', 'Challenge', 'Captivate',
      'Confer', 'Care', 'Control', 'Clarify', 'Consolidate'
    ];

    const stakeholderAreas = [
      'Engage with Other Teachers', 'Engage with School Head', 'Engage with School Community',
      'Engage with parents', 'Engage with PTA, SUBEB, SBMC and other education authority stakeholders',
      'Training/Retreat', 'Other Engagements'
    ];

    const allAreas = [...rubricAreas, ...stakeholderAreas];

    const fellows: { [name: string]: ObservationFellow } = {};
    const observers: { [observer: string]: number } = {};
    const regions: { [region: string]: number } = {};
    const holisticOutcomes: { [outcome: string]: number } = { 'Blank': 0 };
    const leadershipMindsets: { [mindset: string]: number } = { 'Blank': 0 };
    const scoreDistributions: { [area: string]: { [score: number]: number } } = {};

    // Initialize score distributions
    allAreas.forEach(area => {
      scoreDistributions[area] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    });

    observationData.forEach((row) => {
      const fellowName = row['Select Fellows Name'] || row['Fellow Name'] || row['Name'];
      const observer = row['Observer'] || row['Observer Name'];
      const region = row['Region'];

      if (!fellowName || fellowName.trim() === '') return;

      // Initialize fellow
      if (!fellows[fellowName]) {
        fellows[fellowName] = {
          name: fellowName,
          region: region || 'Unknown',
          school: row['Name of School'] || row['School'] || 'Unknown',
          subject: row['Subject'] || 'Unknown',
          observer: observer || 'Unknown',
          scores: [],
          warningCount: 0,
          warningDetails: [],
          sessionCount: 0,
          dominantMindset: 'Blank',
          classRange: row['Select the Class Range'] || row['Class Range'] || 'Unknown'
        };
      }

      fellows[fellowName].sessionCount++;

      // Track observers and regions
      if (observer && observer.trim() !== '') {
        observers[observer] = (observers[observer] || 0) + 1;
      }
      if (region && region.trim() !== '') {
        regions[region] = (regions[region] || 0) + 1;
      }

      // Analyze qualitative data
      const holisticText = row['What clear and observable evidence of student holistic outcomes (Growth Mindset, Self Awareness, Collaboration, Communication, Academic proficiency/mastery) do you see? What do you not see? Why do you think this is?'] || '';
      const leadershipText = row['What clear and observable evidence of the leadership mindsets (Students as leaders, Teachers as Learners, Community as Power, Our work as Systemic) have you seen exhibited? Which one(s) have you not seen? Why do you think this?'] || '';

      // Process holistic outcomes
      if (holisticText.trim()) {
        const lowerText = holisticText.toLowerCase();
        if (lowerText.includes('growth mindset')) holisticOutcomes['Growth Mindset'] = (holisticOutcomes['Growth Mindset'] || 0) + 1;
        if (lowerText.includes('self awareness')) holisticOutcomes['Self Awareness'] = (holisticOutcomes['Self Awareness'] || 0) + 1;
        if (lowerText.includes('collaboration')) holisticOutcomes['Collaboration'] = (holisticOutcomes['Collaboration'] || 0) + 1;
        if (lowerText.includes('communication')) holisticOutcomes['Communication'] = (holisticOutcomes['Communication'] || 0) + 1;
        if (lowerText.includes('academic')) holisticOutcomes['Academic Proficiency'] = (holisticOutcomes['Academic Proficiency'] || 0) + 1;
      } else {
        holisticOutcomes['Blank']++;
      }

      // Process leadership mindsets
      if (leadershipText.trim()) {
        const lowerText = leadershipText.toLowerCase();
        let mindsetFound = false;
        
        if (lowerText.includes('students as leaders')) {
          leadershipMindsets['Students as Leaders'] = (leadershipMindsets['Students as Leaders'] || 0) + 1;
          fellows[fellowName].dominantMindset = 'Students as Leaders';
          mindsetFound = true;
        }
        if (lowerText.includes('teachers as learners')) {
          leadershipMindsets['Teachers as Learners'] = (leadershipMindsets['Teachers as Learners'] || 0) + 1;
          if (!mindsetFound) fellows[fellowName].dominantMindset = 'Teachers as Learners';
          mindsetFound = true;
        }
        if (lowerText.includes('community as power')) {
          leadershipMindsets['Community as Power'] = (leadershipMindsets['Community as Power'] || 0) + 1;
          if (!mindsetFound) fellows[fellowName].dominantMindset = 'Community as Power';
          mindsetFound = true;
        }
        if (lowerText.includes('systemic')) {
          leadershipMindsets['Our Work as Systemic'] = (leadershipMindsets['Our Work as Systemic'] || 0) + 1;
          if (!mindsetFound) fellows[fellowName].dominantMindset = 'Our Work as Systemic';
          mindsetFound = true;
        }
        
        if (!mindsetFound) leadershipMindsets['Blank']++;
      } else {
        leadershipMindsets['Blank']++;
      }

      // Analyze scores and build distributions
      const sessionScores: number[] = [];
      const warningAreas: string[] = [];

      allAreas.forEach(area => {
        const score = parseInt(row[area]);
        if (!isNaN(score) && score >= 1 && score <= 5) {
          scoreDistributions[area][score]++;
          
          if (rubricAreas.includes(area)) {
            sessionScores.push(score);
            if (score <= 2) {
              warningAreas.push(`${area}: ${score}`);
            }
          }
        }
      });

      if (sessionScores.length > 0) {
        fellows[fellowName].scores.push(...sessionScores);
        fellows[fellowName].warningCount += warningAreas.length;
        fellows[fellowName].warningDetails.push(...warningAreas);
      }
    });

    // Calculate final metrics
    Object.values(fellows).forEach(fellow => {
      if (fellow.scores.length > 0) {
        fellow.avgScore = fellow.scores.reduce((sum, s) => sum + s, 0) / fellow.scores.length;
        const lowScores = fellow.scores.filter(s => s <= 2).length;
        const lowScorePercent = (lowScores / fellow.scores.length) * 100;
        fellow.riskLevel = lowScorePercent > 40 ? 'High Risk' : 
                          lowScorePercent > 20 ? 'Medium Risk' : 'Low Risk';
      } else {
        fellow.avgScore = 0;
        fellow.riskLevel = 'No Data';
      }
    });

    return { fellows, observers, regions, rubricAreas, stakeholderAreas, allAreas, holisticOutcomes, leadershipMindsets, scoreDistributions };
  }, [observationData]);

  const analysis = analyzeFellowsTrackerData();
  const observationAnalysis = analyzeObservationData();
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];

  if (loading.some(l => l)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fellows Tracker Comprehensive Dashboard</h1>
          <p className="text-gray-600">Upload files to analyze fellow performance, attendance, and coaching effectiveness</p>
        </div>

        {/* File Upload - 3 sections */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Data Files</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fellows Tracker Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-gray-900 block mb-1">Fellows Tracker</span>
                <span className="text-xs text-gray-500 block mb-3">Weekly attendance & performance data</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'fellows-tracker')} className="hidden" />
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  Choose File
                </span>
              </label>
              {fellowsTrackerData && <p className="text-xs text-green-600 mt-2">✓ File loaded successfully</p>}
            </div>

            {/* Observation Data Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-gray-900 block mb-1">Observation Data</span>
                <span className="text-xs text-gray-500 block mb-3">Teaching performance observations</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'observation')} className="hidden" />
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                  Choose File
                </span>
              </label>
              {observationData && <p className="text-xs text-green-600 mt-2">✓ File loaded successfully</p>}
            </div>

            {/* Personalized Data Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-gray-900 block mb-1">Personalized Data</span>
                <span className="text-xs text-gray-500 block mb-3">Fellow profiles & personalized info</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'personalized')} className="hidden" />
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700">
                  Choose File
                </span>
              </label>
              {personalizedData && <p className="text-xs text-green-600 mt-2">✓ File loaded successfully</p>}
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        {fellowsTrackerData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('fellows-tracker')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'fellows-tracker'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Fellows Tracker Analysis
                </button>
                <button
                  onClick={() => setActiveTab('coach-dashboard')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'coach-dashboard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Coach Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('observation-analysis')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'observation-analysis'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  disabled={!observationData}
                >
                  Observation Analysis {!observationData && '(Upload Required)'}
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Fellows Tracker Analysis */}
        {analysis && activeTab === 'fellows-tracker' && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Total Fellows</p>
                    <p className="text-2xl font-bold text-gray-900">{analysis.totalFellows}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">High Risk</p>
                    <p className="text-2xl font-bold text-red-600">{analysis.riskCounts.high}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Medium Risk</p>
                    <p className="text-2xl font-bold text-yellow-600">{analysis.riskCounts.medium}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Low Risk</p>
                    <p className="text-2xl font-bold text-green-600">{analysis.riskCounts.low}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <XCircle className="h-8 w-8 text-orange-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Payment Issues</p>
                    <p className="text-2xl font-bold text-orange-600">{analysis.paymentIssues}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <UserCheck className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Active Coaches</p>
                    <p className="text-2xl font-bold text-purple-600">{Object.keys(analysis.coaches).length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Gender Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analysis.genderCount).map(([gender, count]) => ({ gender, count }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="gender" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Level Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Level Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High Risk', value: analysis.riskCounts.high, fill: '#ef4444' },
                        { name: 'Medium Risk', value: analysis.riskCounts.medium, fill: '#f59e0b' },
                        { name: 'Low Risk', value: analysis.riskCounts.low, fill: '#10b981' }
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value, percent}) => `${name}: ${value}${typeof percent === 'number' ? ` (${(percent * 100).toFixed(1)}%)` : ''}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* State Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fellows by State</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analysis.states).map(([state, count]) => ({ state, count })).slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="state" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Fellowship Paths */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fellowship Paths</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analysis.fellowshipPaths).map(([path, count], index) => ({
                        name: path,
                        value: count,
                        fill: COLORS[index % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value}) => `${name}: ${value}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Schools Distribution */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Placement Schools</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(analysis.schools)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([school, count]) => ({ school: school.length > 30 ? school.substring(0, 30) + '...' : school, count, fullName: school }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="school" angle={-45} textAnchor="end" height={120} />
                  <YAxis />
                  <Tooltip formatter={(value, name, props) => [value, `Fellows at ${props.payload.fullName}`]} />
                  <Bar dataKey="count" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fellows Analysis Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Fellows Analysis Table</h2>
                <p className="text-sm text-gray-600">Complete breakdown of fellow performance, attendance, and risk assessment</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fellow</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fellowship Path</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coach</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysis.fellows.map((fellow, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{index + 1}. {fellow.fullName}</div>
                          <div className="text-sm text-gray-500">{fellow.school}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {fellow.totalSessions < 10 && (
                              <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm font-medium ${
                              fellow.totalSessions < 10 ? 'text-red-600' : 
                              fellow.totalSessions < 15 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {fellow.totalSessions}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium">
                            {fellow.averageScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium">
                            {fellow.attendanceRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            fellow.riskLevel === 'High Risk' ? 'bg-red-100 text-red-800' :
                            fellow.riskLevel === 'Medium Risk' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {fellow.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{fellow.fellowshipPath}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{fellow.state}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{fellow.coach}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Coach Dashboard */}
        {analysis && activeTab === 'coach-dashboard' && (
          <>
            {/* Coach Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-500">Total Coaches</h3>
                <p className="text-2xl font-bold text-blue-600">{Object.keys(analysis.coaches).length}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-500">Total Fellows</h3>
                <p className="text-2xl font-bold text-green-600">{analysis.totalFellows}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-500">Avg Fellows/Coach</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {(analysis.totalFellows / Object.keys(analysis.coaches).length).toFixed(1)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-500">High Risk Fellows</h3>
                <p className="text-2xl font-bold text-red-600">{analysis.riskCounts.high}</p>
              </div>
            </div>

            {/* Coach-Fellows Table */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Coach-Fellows Overview</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coach Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fellows Under Supervision</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(analysis.coaches)
                      .sort((a, b) => b[1].totalFellows - a[1].totalFellows)
                      .map(([coachName, coachData], index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{coachName}</div>
                          <div className="text-sm text-gray-500">({coachData.totalFellows} Fellows)</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {coachData.fellows.map((fellow, fellowIndex) => (
                              <span key={fellowIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {fellow.fullName}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coach Workload Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fellows per Coach</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analysis.coaches)
                    .sort((a, b) => b[1].totalFellows - a[1].totalFellows)
                    .slice(0, 10)
                    .map(([name, data]) => ({ 
                      coach: name.length > 15 ? name.substring(0, 15) + '...' : name, 
                      fellows: data.totalFellows,
                      fullName: name 
                    }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="coach" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value, name, props) => [value, `Fellows under ${props.payload.fullName}`]} />
                    <Bar dataKey="fellows" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Coach Workload Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analysis.coaches)
                        .sort((a, b) => b[1].totalFellows - a[1].totalFellows)
                        .slice(0, 8)
                        .map(([name, data], index) => ({
                          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
                          value: data.totalFellows,
                          fill: COLORS[index % COLORS.length]
                        }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value}) => `${value}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Coach Details Table */}
            <div className="space-y-6">
              {Object.entries(analysis.coaches)
                .sort((a, b) => b[1].totalFellows - a[1].totalFellows)
                .map(([coachName, coachData], index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{coachName}</h3>
                      <p className="text-sm text-gray-600">{coachData.totalFellows} Fellows</p>
                    </div>
                    <div className="flex space-x-2">
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                        {coachData.riskDistribution.high} High Risk
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        {coachData.riskDistribution.medium} Medium Risk
                      </span>
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        {coachData.riskDistribution.low} Low Risk
                      </span>
                    </div>
                  </div>

                  {/* Fellows under this coach */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coachData.fellows.map((fellow, fellowIndex) => (
                      <div key={fellowIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{fellow.fullName}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            fellow.riskLevel === 'High Risk' ? 'bg-red-100 text-red-800' :
                            fellow.riskLevel === 'Medium Risk' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {fellow.riskLevel}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>School:</strong> {fellow.school}</p>
                          <p><strong>State:</strong> {fellow.state}</p>
                          <p><strong>Path:</strong> {fellow.fellowshipPath}</p>
                          <p><strong>Sessions:</strong> {fellow.totalSessions}</p>
                          <p><strong>Avg Score:</strong> {fellow.averageScore.toFixed(1)}</p>
                          <p><strong>Attendance:</strong> {fellow.attendanceRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* OBSERVATION ANALYSIS - COPIED FROM SECOND CODE */}
        {activeTab === 'observation-analysis' && observationAnalysis && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Total Fellows</p>
                    <p className="text-2xl font-bold text-gray-900">{Object.keys(observationAnalysis.fellows).length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">High Risk</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'High Risk').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Medium Risk</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'Medium Risk').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Low Risk</p>
                    <p className="text-2xl font-bold text-green-600">
                      {Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'Low Risk').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">2+ Warnings</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {Object.values(observationAnalysis.fellows).filter(f => f.warningCount >= 2).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Observations</p>
                    <p className="text-2xl font-bold text-purple-600">{observationData ? observationData.length : 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Distribution Bar Charts */}
            <div className="mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Score Distribution Analysis</h2>
                <p className="text-sm text-gray-600 mb-6">Distribution of ratings (1-5) across all performance areas</p>
                
                {/* Teaching Rubric Areas */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Teaching Effectiveness Areas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {observationAnalysis.rubricAreas.map((area, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">{area}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { rating: '1', count: observationAnalysis.scoreDistributions[area][1], fill: '#ef4444' },
                            { rating: '2', count: observationAnalysis.scoreDistributions[area][2], fill: '#f59e0b' },
                            { rating: '3', count: observationAnalysis.scoreDistributions[area][3], fill: '#10b981' },
                            { rating: '4', count: observationAnalysis.scoreDistributions[area][4], fill: '#3b82f6' },
                            { rating: '5', count: observationAnalysis.scoreDistributions[area][5], fill: '#8b5cf6' }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="rating" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value) => [value, 'Fellows']}
                              labelFormatter={(label) => `Rating: ${label}`}
                            />
                            <Bar dataKey="count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stakeholder Engagement Areas */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Stakeholder Engagement Areas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {observationAnalysis.stakeholderAreas.map((area, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">{area}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { rating: '1', count: observationAnalysis.scoreDistributions[area][1], fill: '#ef4444' },
                            { rating: '2', count: observationAnalysis.scoreDistributions[area][2], fill: '#f59e0b' },
                            { rating: '3', count: observationAnalysis.scoreDistributions[area][3], fill: '#10b981' },
                            { rating: '4', count: observationAnalysis.scoreDistributions[area][4], fill: '#3b82f6' },
                            { rating: '5', count: observationAnalysis.scoreDistributions[area][5], fill: '#8b5cf6' }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="rating" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value) => [value, 'Fellows']}
                              labelFormatter={(label) => `Rating: ${label}`}
                            />
                            <Bar dataKey="count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Legend */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">Rating Scale:</h4>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded mr-1"></div>1 = Superficial</span>
                    <span className="flex items-center"><div className="w-3 h-3 bg-amber-500 rounded mr-1"></div>2 = Honest Effort</span>
                    <span className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded mr-1"></div>3 = Effective</span>
                    <span className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>4 = Highly Effective</span>
                    <span className="flex items-center"><div className="w-3 h-3 bg-purple-500 rounded mr-1"></div>5 = Outstanding</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Holistic Outcomes */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Holistic Outcomes Evidence</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(observationAnalysis.holisticOutcomes).map(([name, count], index) => ({
                        name: name,
                        value: count,
                        fill: name === 'Blank' ? '#94a3b8' : COLORS[index % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value, percent}) => `${name}: ${value}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2">Evidence of Growth Mindset, Self Awareness, Collaboration, Communication, Academic Proficiency</p>
              </div>

              {/* Leadership Mindsets */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Leadership Mindsets Evidence</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(observationAnalysis.leadershipMindsets).map(([name, count], index) => ({
                        name: name,
                        value: count,
                        fill: name === 'Blank' ? '#94a3b8' : COLORS[index % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value, percent}) => `${name}: ${value}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2">Evidence of Students as Leaders, Teachers as Learners, Community as Power, Our Work as Systemic</p>
              </div>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Risk Level Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Level Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High Risk', value: Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'High Risk').length, fill: '#ef4444' },
                        { name: 'Medium Risk', value: Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'Medium Risk').length, fill: '#f59e0b' },
                        { name: 'Low Risk', value: Object.values(observationAnalysis.fellows).filter(f => f.riskLevel === 'Low Risk').length, fill: '#10b981' }
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({name, value, percent}) => `${name}: ${value}`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2">Distribution of fellows by risk assessment level</p>
              </div>

              {/* Class Size Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Size Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(() => {
                    const classSizes: { [size: string]: number } = {};
                    Object.values(observationAnalysis.fellows).forEach(fellow => {
                      const size = fellow.classRange || 'Unknown';
                      classSizes[size] = (classSizes[size] || 0) + 1;
                    });
                    return Object.entries(classSizes).map(([size, count]) => ({ size, count }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="size" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2">Number of learners in fellows' classrooms</p>
              </div>
            </div>

            {/* Fellows Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Fellows Analysis</h2>
                <p className="text-sm text-gray-600">Complete breakdown of fellow performance and risk indicators</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fellow</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class Range</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leadership Mindset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observer</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(observationAnalysis.fellows).map((fellow, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{fellow.name}</div>
                          <div className="text-sm text-gray-500">{fellow.subject}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{fellow.classRange}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              typeof fellow.avgScore === 'number' && fellow.avgScore >= 3.5 ? 'bg-green-500' :
                              typeof fellow.avgScore === 'number' && fellow.avgScore >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium">
                              {typeof fellow.avgScore === 'number' && fellow.avgScore > 0 ? fellow.avgScore.toFixed(1) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            fellow.riskLevel === 'High Risk' ? 'bg-red-100 text-red-800' :
                            fellow.riskLevel === 'Medium Risk' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {fellow.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {fellow.warningCount >= 2 && (
                              <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <div>
                              <span className={`text-sm font-medium ${
                                fellow.warningCount >= 2 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {fellow.warningCount}
                              </span>
                              {fellow.warningDetails && fellow.warningDetails.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  <details className="cursor-pointer">
                                    <summary className="text-blue-600 hover:text-blue-800">Details</summary>
                                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-w-xs">
                                      {fellow.warningDetails.slice(0, 3).map((detail, idx) => (
                                        <div key={idx} className="mb-1">{detail}</div>
                                      ))}
                                      {fellow.warningDetails.length > 3 && (
                                        <div className="text-gray-400">+{fellow.warningDetails.length - 3} more</div>
                                      )}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            fellow.dominantMindset === 'Blank' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {fellow.dominantMindset}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{fellow.region}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{fellow.observer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Observation Analysis (Placeholder when no data) */}
        {activeTab === 'observation-analysis' && !observationData && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Observation Analysis</h3>
            <p className="text-gray-600 mb-4">Upload observation data to see teaching effectiveness analysis, score distributions, and risk assessments.</p>
            <p className="text-sm text-gray-500">This section will include 15+ charts analyzing teaching rubrics, stakeholder engagement, and qualitative evidence.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default FellowsTrackerDashboard;