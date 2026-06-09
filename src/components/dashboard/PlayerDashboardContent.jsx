import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Star, MapPin, TrendingUp, Camera, ChevronRight,
  Target, Gift, DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlayerDashboardContent({ user, missions, missionBusinesses, activeMissions, recentMissions, onWithdraw, onMissionClick }) {
  return (
    <>
      {/* Balance card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[var(--cashlap-yellow)]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">${(user?.total_earnings || 0).toFixed(2)}</p>
                <p className="text-gray-700">Available Balance</p>
              </div>
            </div>
            <Button onClick={onWithdraw} className="bg-[var(--cashlap-yellow)] hover:opacity-90 text-white">
              <DollarSign className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <Target className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-orange)]" />
            <p className="text-2xl font-bold text-gray-900">{user?.missions_completed || 0}</p>
            <p className="text-sm text-gray-700">Missions</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <Star className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-yellow)]" />
            <p className="text-2xl font-bold text-gray-900">{user?.level || 1}</p>
            <p className="text-sm text-gray-700">Level</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-green)]" />
            <p className="text-2xl font-bold text-gray-900">{activeMissions.length}</p>
            <p className="text-sm text-gray-700">Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Active missions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Missions</CardTitle>
            <Link to={createPageUrl("Explore")}>
              <Button variant="ghost" size="sm">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeMissions.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p className="text-gray-700 mb-4">No active missions</p>
              <Link to={createPageUrl("Explore")}>
                <Button className="bg-[var(--cashlap-green)] hover:opacity-90 text-white">Find Missions</Button>
              </Link>
            </div>
          ) : (
            activeMissions.slice(0, 3).map((mission) => (
              <div
                key={mission.id}
                className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                onClick={() => onMissionClick(mission)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-[var(--cashlap-orange)] rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{mission.title}</h3>
                    <p className="text-gray-700 mt-1">{missionBusinesses[mission.business_id] || 'Business'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className="bg-[var(--cashlap-yellow)]/20 text-yellow-800">
                        ${mission.reward_amount}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <Camera className="w-3 h-3" />
                        <span>Tap to continue</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {activeMissions.length > 3 && (
            <div className="text-center pt-2">
              <Link to={createPageUrl("Explore")}>
                <Button variant="ghost">
                  View {activeMissions.length - 3} more active missions
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      {recentMissions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentMissions.map((mission) => (
              <div key={mission.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-[var(--cashlap-green)]" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-medium text-gray-900 truncate">{mission.title}</p>
                  <p className="text-gray-700 text-sm truncate">{missionBusinesses[mission.business_id] || 'Business'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {mission.status === 'approved'
                    ? <p className="font-semibold text-[var(--cashlap-green)]">+${mission.reward_amount}</p>
                    : <p className="font-semibold text-red-500">$0.00</p>
                  }
                  <p className="text-sm text-gray-600 capitalize">{mission.status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
