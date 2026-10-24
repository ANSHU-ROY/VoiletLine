// server/services/hazardService.ts
import { IDatabaseAdapter } from '../db/adapter.js';
import { calculateHaversineDistance, LatLng } from './geoService.js';

export interface CreateHazardParams {
  reporterId?: string;
  stationSlug: string;
  category: 'broken_streetlight' | 'waterlogged_underpass' | 'isolated_dark_stretch' | 'harassment_stray_alert';
  title: string;
  description?: string;
  lat: number;
  lng: number;
}

export class HazardService {
  private db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  /**
   * Report a hazard with 30m duplicate merging
   */
  reportHazard(params: CreateHazardParams) {
    const { reporterId, stationSlug, category, title, description, lat, lng } = params;

    // Check for duplicate hazard within 30 meters (0.03 km) of same category
    const activeSameCategory = this.db.query<{ id: string; lat: number; lng: number; upvotes: number }>(`
      SELECT id, lat, lng, upvotes
      FROM hazard_reports
      WHERE station_slug = ? AND category = ? AND is_active = 1
    `, [stationSlug, category]);

    for (const h of activeSameCategory) {
      const dist = calculateHaversineDistance({ lat, lng }, { lat: h.lat, lng: h.lng });
      if (dist <= 0.03) {
        // Within 30 meters! Merge as upvote / confirmation
        this.db.execute(`
          UPDATE hazard_reports
          SET upvotes = upvotes + 1
          WHERE id = ?
        `, [h.id]);
        return {
          id: h.id,
          isDuplicateMerged: true,
          upvotes: h.upvotes + 1,
          message: 'Existing hazard confirmed and upvoted within 30m.'
        };
      }
    }

    // Expiry: 24h for waterlogging, 7 days for other categories
    const lifespanHours = category === 'waterlogged_underpass' ? 24 : 7 * 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + lifespanHours * 3600 * 1000).toISOString();
    const id = `hazard-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    this.db.execute(`
      INSERT INTO hazard_reports (
        id, reporter_id, station_slug, category, title, description,
        lat, lng, upvotes, is_active, moderation_status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'active', ?, ?)
    `, [id, reporterId || null, stationSlug, category, title, description || '', lat, lng, now.toISOString(), expiresAt]);

    return {
      id,
      isDuplicateMerged: false,
      upvotes: 1,
      message: 'New hazard report registered successfully.'
    };
  }

  /**
   * Upvote / "Still there" confirmation
   */
  confirmHazard(hazardId: string) {
    const hazard = this.db.queryOne<{ id: string; category: string; upvotes: number }>(
      'SELECT id, category, upvotes FROM hazard_reports WHERE id = ?',
      [hazardId]
    );
    if (!hazard) return null;

    // Extend expiration on confirmation
    const lifespanHours = hazard.category === 'waterlogged_underpass' ? 24 : 7 * 24;
    const newExpiresAt = new Date(Date.now() + lifespanHours * 3600 * 1000).toISOString();

    this.db.execute(`
      UPDATE hazard_reports
      SET upvotes = upvotes + 1, expires_at = ?
      WHERE id = ?
    `, [newExpiresAt, hazardId]);

    return { id: hazardId, upvotes: hazard.upvotes + 1 };
  }

  /**
   * Get active hazards for a station corridor
   */
  getActiveHazards(stationSlug: string) {
    const now = new Date().toISOString();
    return this.db.query<any>(`
      SELECT *
      FROM hazard_reports
      WHERE station_slug = ?
        AND is_active = 1
        AND moderation_status = 'active'
        AND expires_at > ?
      ORDER BY upvotes DESC, created_at DESC
    `, [stationSlug, now]);
  }

  /**
   * Compute Safety Level for a route or corridor (green/amber/red)
   */
  evaluateCorridorSafety(stationSlug: string, corridorPoints: LatLng[]) {
    const hazards = this.getActiveHazards(stationSlug);
    let nearbyHazardsCount = 0;
    let hasHighRiskAlert = false;

    for (const h of hazards) {
      for (const pt of corridorPoints) {
        const dist = calculateHaversineDistance(pt, { lat: h.lat, lng: h.lng });
        if (dist <= 0.25) {
          // Within 250m
          nearbyHazardsCount++;
          if (h.category === 'harassment_stray_alert' || h.category === 'waterlogged_underpass') {
            hasHighRiskAlert = true;
          }
          break;
        }
      }
    }

    if (nearbyHazardsCount === 0) {
      return { level: 'green', score: 95, label: 'Well-Lit Safe Corridor', nearbyCount: 0 };
    } else if (nearbyHazardsCount <= 2 && !hasHighRiskAlert) {
      return { level: 'amber', score: 70, label: 'Caution Advised (Moderate Lighting)', nearbyCount: nearbyHazardsCount };
    } else {
      return { level: 'red', score: 40, label: 'High Hazard Density (Shared Transit Advised)', nearbyCount: nearbyHazardsCount };
    }
  }

  /**
   * Admin moderation
   */
  moderateHazard(hazardId: string, status: 'active' | 'rejected' | 'resolved') {
    this.db.execute(`
      UPDATE hazard_reports
      SET moderation_status = ?, is_active = CASE WHEN ? = 'active' THEN 1 ELSE 0 END
      WHERE id = ?
    `, [status, status, hazardId]);
    return { success: true, hazardId, status };
  }
}
