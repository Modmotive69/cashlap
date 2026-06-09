import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, BarChart2, DollarSign, Target, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BusinessDashboardContent({ user, business, campaigns }) {
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Business Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${(user?.business_balance || 0).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Available to fund campaigns</p>
          <Link to={createPageUrl("BusinessFunding")} className="mt-4 block">
            <Button className="w-full bg-[var(--cashlap-blue)] hover:opacity-90 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Funds
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Link to={createPageUrl("CampaignManager")}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <Plus className="w-8 h-8 mx-auto mb-3 text-[var(--cashlap-blue)]" />
              <p className="font-medium">Create Campaign</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("BusinessAnalytics")}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <BarChart2 className="w-8 h-8 mx-auto mb-3 text-[var(--cashlap-pink)]" />
              <p className="font-medium">View Analytics</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p className="text-gray-700 mb-4">No campaigns yet</p>
              <Link to={createPageUrl("CampaignManager")}>
                <Button className="bg-[var(--cashlap-blue)] hover:opacity-90 text-white">
                  Create Your First Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 3).map((campaign) => (
                <div key={campaign.id} className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
                  <p className="text-gray-700 mt-1">{campaign.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="bg-[var(--cashlap-green)]/20 text-green-800">
                      ${campaign.reward_amount}
                    </Badge>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {campaigns.length > 3 && (
                <Link to={createPageUrl("CampaignManager")}>
                  <Button variant="ghost" className="w-full mt-2">
                    View All Campaigns <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
