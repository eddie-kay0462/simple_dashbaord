"use client";
import React, { useState } from 'react';
import { Upload, Users, AlertTriangle, TrendingUp, FileText, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const FellowDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setLoading(true);
    setError(null);

    try {
      const fileData = await file.arrayBuffer();
      let parsedData;

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(fileData);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(fileData);
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
      } else {
        throw new Error('Please upload an Excel (.xlsx) or CSV file');
      }

      setData(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeData = () => {
    if (!data || data.length === 0) return null;

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

    const fellows = {};
    const observers = {};
    const regions = {};
    const holisticOutcomes = { 'Blank': 0 };
    const leadershipMindsets = { 'Blank': 0 };
    const scoreDistributions = {};

    // Initialize score distributions
    allAreas.forEach(area => {
      scoreDistributions[area] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    });

    data.forEach((row) => {
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
          dominantMindset: 'Blank'
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
      const sessionScores = [];
      const warningAreas = [];

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
  };

  const analysis = analyzeData();
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fellow Support Dashboard</h1>
          <p className="text-gray-600">Upload Excel or CSV files to analyze fellow performance and coaching needs</p>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <label className="cursor-pointer">
              <span className="text-lg font-medium text-gray-900 block mb-2">Upload Excel or CSV File</span>
              <span className="text-gray-500 block mb-4">Click to select your observation data file</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Choose File
              </span>
            </label>
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

        {/* Dashboard Content */}
        {analysis && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Total Fellows</p>
                    <p className="text-2xl font-bold text-gray-900">{Object.keys(analysis.fellows).length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">High Risk</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Object.values(analysis.fellows).filter(f => f.riskLevel === 'High Risk').length}
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
                      {Object.values(analysis.fellows).filter(f => f.riskLevel === 'Medium Risk').length}
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
                      {Object.values(analysis.fellows).filter(f => f.riskLevel === 'Low Risk').length}
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
                      {Object.values(analysis.fellows).filter(f => f.warningCount >= 2).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Observations</p>
                    <p className="text-2xl font-bold text-purple-600">{data ? data.length : 0}</p>
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
                    {analysis.rubricAreas.map((area, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">{area}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { rating: '1', count: analysis.scoreDistributions[area][1], fill: '#ef4444' },
                            { rating: '2', count: analysis.scoreDistributions[area][2], fill: '#f59e0b' },
                            { rating: '3', count: analysis.scoreDistributions[area][3], fill: '#10b981' },
                            { rating: '4', count: analysis.scoreDistributions[area][4], fill: '#3b82f6' },
                            { rating: '5', count: analysis.scoreDistributions[area][5], fill: '#8b5cf6' }
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
                    {analysis.stakeholderAreas.map((area, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">{area}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { rating: '1', count: analysis.scoreDistributions[area][1], fill: '#ef4444' },
                            { rating: '2', count: analysis.scoreDistributions[area][2], fill: '#f59e0b' },
                            { rating: '3', count: analysis.scoreDistributions[area][3], fill: '#10b981' },
                            { rating: '4', count: analysis.scoreDistributions[area][4], fill: '#3b82f6' },
                            { rating: '5', count: analysis.scoreDistributions[area][5], fill: '#8b5cf6' }
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
                      data={Object.entries(analysis.holisticOutcomes).map(([name, count], index) => ({
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
                      data={Object.entries(analysis.leadershipMindsets).map(([name, count], index) => ({
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
                        { name: 'High Risk', value: Object.values(analysis.fellows).filter(f => f.riskLevel === 'High Risk').length, fill: '#ef4444' },
                        { name: 'Medium Risk', value: Object.values(analysis.fellows).filter(f => f.riskLevel === 'Medium Risk').length, fill: '#f59e0b' },
                        { name: 'Low Risk', value: Object.values(analysis.fellows).filter(f => f.riskLevel === 'Low Risk').length, fill: '#10b981' }
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

              {/* Observer Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Observer Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analysis.observers).map(([name, count], index) => ({
                        name: name && name.length > 15 ? name.substring(0, 15) + '...' : name || 'Unknown',
                        value: count,
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
                <p className="text-sm text-gray-600 mt-2">Number of fellows observed by each observer</p>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leadership Mindset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observer</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(analysis.fellows).map((fellow, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{fellow.name}</div>
                          <div className="text-sm text-gray-500">{fellow.subject}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              fellow.avgScore >= 3.5 ? 'bg-green-500' :
                              fellow.avgScore >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium">
                              {fellow.avgScore > 0 ? fellow.avgScore.toFixed(1) : 'N/A'}
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
      </div>
    </div>
  );
};

export default FellowDashboard;