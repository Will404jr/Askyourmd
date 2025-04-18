"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Import shadcn/ui chart components
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Issue {
  _id: string;
  subject: string;
  category: string;
  content: string;
  status: "Open" | "Closed" | "Pending" | "Overdue" | "Urgent";
  submittedBy: string;
  assignedTo: string | null;
  dueDate: Date;
  createdAt: string;
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  totalIssues: number;
  closedIssues: number;
}

interface StatusCard {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const LoadingCard = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-4 rounded-full" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-[60px]" />
    </CardContent>
  </Card>
);

const LoadingChart = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between">
      <Skeleton className="h-6 w-[150px]" />
      <Skeleton className="h-10 w-[120px]" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[600px] w-full" />
    </CardContent>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 shadow-lg rounded-lg border">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.value} Issues
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalysisPage() {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [monthlyData, setMonthlyData] = React.useState<MonthlyData[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [selectedYear, setSelectedYear] = React.useState<string>(
    new Date().getFullYear().toString()
  );
  const [availableYears, setAvailableYears] = React.useState<string[]>([]);
  const [filteredData, setFilteredData] = React.useState<MonthlyData[]>([]);

  // Handle year selection change
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    filterDataByYear(year);
  };

  // Filter data by selected year
  const filterDataByYear = (year: string) => {
    const filtered = monthlyData.filter((item) => {
      const [itemYear] = item.month.split("-");
      return itemYear === year;
    });
    setFilteredData(filtered);
  };

  React.useEffect(() => {
    const fetchIssues = async () => {
      try {
        const response = await fetch("/api/issues");
        const data: Issue[] = await response.json();
        setIssues(data);

        const monthlyIssues = processMonthlyData(data);
        setMonthlyData(monthlyIssues);

        // Extract available years from the data
        const years = [
          ...new Set(monthlyIssues.map((item) => item.month.split("-")[0])),
        ];
        setAvailableYears(years);

        // Set current year as default if available, otherwise use the most recent year
        const currentYear = new Date().getFullYear().toString();
        const defaultYear = years.includes(currentYear)
          ? currentYear
          : years[years.length - 1];
        setSelectedYear(defaultYear);

        // Filter data for the default year
        const filtered = monthlyIssues.filter(
          (item) => item.month.split("-")[0] === defaultYear
        );
        setFilteredData(filtered);
      } catch (error) {
        console.error("Error fetching issues:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

  const processMonthlyData = (data: Issue[]): MonthlyData[] => {
    const months: Record<string, { total: number; closed: number }> = {};
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // First, collect data from issues
    data.forEach((issue) => {
      const date = new Date(issue.createdAt);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!months[monthKey]) {
        months[monthKey] = { total: 0, closed: 0 };
      }
      months[monthKey].total++;
      if (issue.status === "Closed") {
        months[monthKey].closed++;
      }
    });

    // Get all unique years from the data
    const years = [
      ...new Set(Object.keys(months).map((key) => key.split("-")[0])),
    ];

    // Create a complete dataset with all months for each year
    const completeData: MonthlyData[] = [];

    years.forEach((year) => {
      monthNames.forEach((month, index) => {
        const monthNum = String(index + 1).padStart(2, "0");
        const monthKey = `${year}-${monthNum}`;

        completeData.push({
          month: monthKey,
          monthLabel: `${month} ${year}`,
          totalIssues: months[monthKey]?.total || 0,
          closedIssues: months[monthKey]?.closed || 0,
        });
      });
    });

    return completeData.sort((a, b) => a.month.localeCompare(b.month));
  };

  const statusCounts = {
    Open: issues.filter((issue) => issue.status === "Open").length,
    Closed: issues.filter((issue) => issue.status === "Closed").length,
    Pending: issues.filter((issue) => issue.status === "Pending").length,
    Overdue: issues.filter((issue) => issue.status === "Overdue").length,
    Urgent: issues.filter((issue) => issue.status === "Urgent").length,
  };

  const statusCards: StatusCard[] = [
    {
      title: "Open Issues",
      value: statusCounts.Open,
      icon: Activity,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Closed Issues",
      value: statusCounts.Closed,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Pending Issues",
      value: statusCounts.Pending,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Overdue Issues",
      value: statusCounts.Overdue,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Urgent Issues",
      value: statusCounts.Urgent,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
        <LoadingChart />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statusCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Issue Trends</CardTitle>
          {availableYears.length > 1 && (
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="w-full">
          <div className="w-full" style={{ height: "500px" }}>
            <ChartContainer
              config={{
                totalIssues: {
                  label: "Total Issues",
                  color: "#3b82f6", // Original blue color
                },
                closedIssues: {
                  label: "Closed Issues",
                  color: "#22c55e", // Original green color
                },
              }}
              className="w-full h-full"
            >
              <BarChart
                accessibilityLayer
                data={filteredData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 0,
                  bottom: 60,
                }}
                width={undefined}
                height={520}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 12,
                  }}
                />
                <YAxis />
                <Bar dataKey="totalIssues" fill="#3b82f6" radius={4} />
                <Bar dataKey="closedIssues" fill="#22c55e" radius={4} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${value} Issues`}
                    />
                  }
                />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
