import { useState, useEffect } from 'react';
import { Mission, CheckIn, QRCode } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, PieChart as PieChartIcon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Pie, Cell } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';

const CHART_COLORS = {
  approved: '#22c55e', // green-500
  submitted: '#f59e0b', // amber-500
  active: '#3b82f6', // blue-500
  rejected: '#ef4444', // red-500
};

export default function CampaignAnalyticsDetail({ campaign }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (campaign) {
            loadAnalyticsData();
        }
    }, [campaign]);

    const loadAnalyticsData = async () => {
        setLoading(true);
        try {
            const [missions, checkIns, qrCodes] = await Promise.all([
                Mission.filter({ campaign_id: campaign.id }),
                CheckIn.filter({ campaign_id: campaign.id, status: 'valid' }),
                QRCode.filter({ campaign_id: campaign.id })
            ]);

            // KPI Calculations
            const totalSubmissions = missions.length;
            const approvedMissions = missions.filter(m => m.status === 'approved').length;
            const rejectedMissions = missions.filter(m => m.status === 'rejected').length;
            const pendingMissions = missions.filter(m => m.status === 'submitted').length;
            const approvalRate = (approvedMissions + rejectedMissions) > 0 ? (approvedMissions / (approvedMissions + rejectedMissions)) * 100 : 0;
            const totalSpent = approvedMissions * campaign.reward_amount;

            // Time Series Data (last 30 days)
            const endDate = new Date();
            const startDate = subDays(endDate, 29);
            const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });

            const checkInsByDate = checkIns.reduce((acc, checkIn) => {
                const date = format(new Date(checkIn.created_date), 'yyyy-MM-dd');
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            }, {});
            
            const timeSeriesData = dateInterval.map(date => ({
                date: format(date, 'MMM d'),
                checkIns: checkInsByDate[format(date, 'yyyy-MM-dd')] || 0
            }));

            // Mission Status Pie Chart Data
            const missionStatusData = [
                { name: 'Approved', value: approvedMissions, color: CHART_COLORS.approved },
                { name: 'Pending', value: pendingMissions, color: CHART_COLORS.submitted },
                { name: 'Rejected', value: rejectedMissions, color: CHART_COLORS.rejected },
                { name: 'Active (Not Submitted)', value: missions.filter(m=>m.status === 'active').length, color: CHART_COLORS.active }
            ].filter(item => item.value > 0);

            // Location Performance
            const qrCodeLookup = new Map(qrCodes.map(qr => [qr.id, qr.location_name]));
            const checkInsByLocation = checkIns.reduce((acc, checkIn) => {
                const locationName = qrCodeLookup.get(checkIn.qr_code_id) || 'Unknown Location';
                acc[locationName] = (acc[locationName] || 0) + 1;
                return acc;
            }, {});

            const locationPerformanceData = Object.entries(checkInsByLocation)
                .map(([name, checkIns]) => ({ name, checkIns }))
                .sort((a,b) => b.checkIns - a.checkIns);

            setStats({
                totalCheckIns: checkIns.length,
                totalSubmissions,
                pendingMissions,
                approvalRate,
                totalSpent,
                timeSeriesData,
                missionStatusData,
                locationPerformanceData
            });

        } catch (error) {
            console.error("Failed to load campaign analytics", error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) {
        return <div className="p-6 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
    }

    if (!stats) {
        return <div className="p-6 text-center text-gray-500">Could not load analytics data.</div>;
    }
    
    if (stats.totalCheckIns === 0 && stats.totalSubmissions === 0) {
        return <div className="p-6 text-center text-gray-500">No activity yet for this campaign.</div>
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Campaign Analytics: {campaign.title}</h3>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                <Card><CardHeader className="p-2 sm:p-3"><CardTitle className="text-xs sm:text-sm font-medium">Total Check-ins</CardTitle></CardHeader><CardContent className="p-2 sm:p-3"><p className="text-xl sm:text-2xl font-bold">{stats.totalCheckIns}</p></CardContent></Card>
                <Card><CardHeader className="p-2 sm:p-3"><CardTitle className="text-xs sm:text-sm font-medium">Submissions</CardTitle></CardHeader><CardContent className="p-2 sm:p-3"><p className="text-xl sm:text-2xl font-bold">{stats.totalSubmissions}</p></CardContent></Card>
                <Card><CardHeader className="p-2 sm:p-3"><CardTitle className="text-xs sm:text-sm font-medium">Pending Review</CardTitle></CardHeader><CardContent className="p-2 sm:p-3"><p className="text-xl sm:text-2xl font-bold">{stats.pendingMissions}</p></CardContent></Card>
                <Card><CardHeader className="p-2 sm:p-3"><CardTitle className="text-xs sm:text-sm font-medium">Approval Rate</CardTitle></CardHeader><CardContent className="p-2 sm:p-3"><p className="text-xl sm:text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</p></CardContent></Card>
                <Card className="col-span-2 sm:col-span-1 lg:col-span-1"><CardHeader className="p-2 sm:p-3"><CardTitle className="text-xs sm:text-sm font-medium">Total Spent</CardTitle></CardHeader><CardContent className="p-2 sm:p-3"><p className="text-xl sm:text-2xl font-bold">${stats.totalSpent.toFixed(2)}</p></CardContent></Card>
            </div>

            {/* Check-ins over time */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-5 h-5 text-blue-600"/>Check-ins Over Last 30 Days</CardTitle></CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={stats.timeSeriesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis allowDecimals={false}/>
                            <Tooltip />
                            <Area type="monotone" dataKey="checkIns" stroke="#3b82f6" fill="#bfdbfe" name="Check-ins" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mission Status */}
                {stats.missionStatusData.length > 0 && <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PieChartIcon className="w-5 h-5 text-purple-600"/>Mission Status</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <Pie data={stats.missionStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                {stats.missionStatusData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                            </Pie>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                            {stats.missionStatusData.map(entry => (
                                <div key={entry.name} className="flex items-center gap-2 text-sm">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                    <span>{entry.name} ({entry.value})</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>}
                
                {/* Location Performance */}
                {stats.locationPerformanceData.length > 0 && <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart2 className="w-5 h-5 text-green-600"/>Check-ins by Location</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                           {stats.locationPerformanceData.map(loc => (
                               <div key={loc.name} className="text-sm">
                                   <div className="flex justify-between items-center mb-1">
                                       <p className="font-medium text-gray-700 truncate pr-2">{loc.name}</p>
                                       <p className="font-semibold text-gray-800">{loc.checkIns}</p>
                                   </div>
                                   <div className="w-full bg-gray-200 rounded-full h-2">
                                       <div className="bg-green-500 h-2 rounded-full" style={{width: `${(loc.checkIns / stats.totalCheckIns) * 100}%`}}></div>
                                   </div>
                               </div>
                           ))}
                        </div>
                    </CardContent>
                </Card>}
            </div>
        </div>
    );
}