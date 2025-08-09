import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Pool } from 'pg';

@Injectable()
export class NoxumService {
  private dubaiPulsePool: Pool | null = null;

  private getDubaiPulsePool(): Pool {
    if (this.dubaiPulsePool) return this.dubaiPulsePool;
    const host = process.env.DATABASE_HOST || '';
    const port = process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432;
    const user = process.env.DATABASE_USER || '';
    const password = process.env.DATABASE_PASSWORD || '';
    const database = process.env.DUBAIPULSE_DATABASE_NAME || '';
    this.dubaiPulsePool = new Pool({ host, port, user, password, database, max: 5 });
    return this.dubaiPulsePool;
  }
  async getProperties(url: string): Promise<any> {
    // Handle Property Finder URLs (non-Selenium path for now)
    if (this.isPropertyFinderUrl(url)) {
      try {
        const headers = this.buildDesktopHeaders();
        const response = await axios.get<string>(url, {
          headers,
          timeout: 20000,
          validateStatus: () => true,
        });
        const statusCode = response.status;
        const html = response.data || '';

        // Detect bot protection or upstream errors
        if (statusCode >= 400) {
          return {
            success: false,
            source: 'propertyfinder',
            url,
            error: `Upstream responded with status ${statusCode}`,
          };
        }
        if (this.looksLikeBotBlock(html)) {
          return {
            success: false,
            source: 'propertyfinder',
            url,
            error: 'Bot protection detected (Cloudflare or similar). Consider Selenium/cookies/rotating headers.',
          };
        }

        const nextData = this.tryParseNextData(html);
        if (!nextData) {
          return {
            success: false,
            source: 'propertyfinder',
            url,
            error: 'Unable to locate Next.js data on the page',
          };
        }

        // Extract using deep search through __NEXT_DATA__ JSON
        const fullName = this.deepFindFirstStringByKey(nextData, 'full_name');
        const location = this.splitLocation(fullName || null);

        const coordsObj = this.deepFindObjectWithKeys(nextData, ['lat', 'lon']);
        const lat = coordsObj && typeof (coordsObj as any).lat !== 'undefined' ? (coordsObj as any).lat : null;
        const lon = coordsObj && typeof (coordsObj as any).lon !== 'undefined' ? (coordsObj as any).lon : null;

        // Prefer direct path for property data; fallback to deep search
        const propertyRoot = this.getValueAtPath(nextData, ['props', 'pageProps', 'propertyResult', 'property']);
        const zoneName: string | null =
          (propertyRoot && typeof propertyRoot.zone_name === 'string' ? propertyRoot.zone_name : null) ||
          this.deepFindFirstStringByKey(nextData, 'zone_name');
        const bedroomsValue: number | null =
          (propertyRoot && typeof propertyRoot.bedrooms_value === 'number' ? propertyRoot.bedrooms_value : null) ||
          this.deepFindFirstNumberByKey(nextData, 'bedrooms_value');
        const bathroomsValue: number | null =
          (propertyRoot && typeof propertyRoot.bathrooms_value === 'number' ? propertyRoot.bathrooms_value : null) ||
          this.deepFindFirstNumberByKey(nextData, 'bathrooms_value');

        // Find first image small URL and fetch as base64
        const imageSmallUrl = this.findFirstSmallImage(propertyRoot) || this.deepFindFirstUrlByKey(nextData, 'small');
        let imageSmallBase64: string | null = null;
        if (typeof imageSmallUrl === 'string' && imageSmallUrl.startsWith('http')) {
          imageSmallBase64 = await this.fetchImageAsBase64(imageSmallUrl, url);
        }

        const reraRoot = this.deepFindObjectByKey(nextData, 'rera') || nextData;
        const reraObj = this.deepFindObjectWithKeys(reraRoot, ['number']);
        let permitNumber: string | null = reraObj?.number || null;
        let permitUrl: string | null = reraObj?.permit_validation_url || null;

        if (!permitNumber) {
          permitNumber =
            this.deepFindFirstStringByKey(nextData, 'permitNumber') ||
            this.deepFindFirstStringByKey(nextData, 'reraPermitNumber') ||
            null;
        }
        if (!permitUrl) {
          permitUrl = this.deepFindFirstStringByKey(nextData, 'permit_validation_url') || null;
        }

        const brokerObj = this.deepFindObjectByKey(nextData, 'broker');
        const company = brokerObj && typeof (brokerObj as any).name === 'string' ? (brokerObj as any).name : '';

        if (!permitNumber) {
          return {
            success: false,
            source: 'propertyfinder',
            url,
            error: 'No RERA permit number found in the listing',
          };
        }

        const resultPayload = {
          success: true,
          source: 'propertyfinder',
          url,
          location: {
            full_name: fullName || null,
            emirate: location.emirate,
            main_area: location.main_area,
            sub_area: location.sub_area,
            sub_sub_area: location.sub_sub_area,
          },
          coordinates:
            lat !== null && lon !== null
              ? {
                  lat: Number(lat),
                  lon: Number(lon),
                  gmap: `https://maps.google.com/?q=${lat},${lon}`,
                }
              : null,
          rera: {
            permit_number: permitNumber,
            permit_url: permitUrl,
          },
          property: {
            zone_name: zoneName || null,
            bedrooms_value: bedroomsValue ?? null,
            bathrooms_value: bathroomsValue ?? null,
            image_small_url: imageSmallUrl || null,
            image_small_base64: imageSmallBase64,
            price: this.getValueAtPath(nextData, ['props', 'pageProps', 'propertyResult', 'property', 'price', 'value']) ?? null,
            size: this.getValueAtPath(nextData, ['props', 'pageProps', 'propertyResult', 'property', 'size', 'value']) ?? null,
          },
          company,
        };

        await this.enrichWithDubaiPulse(resultPayload);

        return resultPayload;
      } catch (error: any) {
        return {
          success: false,
          source: 'propertyfinder',
          url,
          error: error?.message || 'Failed to fetch or parse the page',
        };
      }
    }

    // Handle Bayut URLs (attempts without Selenium)
    if (this.isBayutUrl(url)) {
      try {
        const headers = this.buildDesktopHeaders();
        const response = await axios.get<string>(url, {
          headers,
          timeout: 25000,
          validateStatus: () => true,
        });
        const statusCode = response.status;
        const html = response.data || '';

        if (statusCode >= 400) {
          return {
            success: false,
            source: 'bayut',
            url,
            error: `Upstream responded with status ${statusCode}`,
          };
        }
        if (this.looksLikeBotBlock(html)) {
          return {
            success: false,
            source: 'bayut',
            url,
            error: 'Bot protection detected (Cloudflare or similar). A headful browser or proxy may be required.',
          };
        }

        // Try window.state first (Bayut legacy approach)
        let listingData: any = null;
        const stateObj = this.extractWindowStateFromHtml(html);
        if (stateObj) {
          const propertyObj = this.deepFindObjectByKey(stateObj, 'property');
          if (propertyObj) {
            // If property contains data node, use it; else use property itself
            listingData = (propertyObj && typeof propertyObj.data === 'object') ? propertyObj.data : propertyObj;
          }
        }

        // Fallback: Try __NEXT_DATA__ and then a potential _next/data endpoint
        if (!listingData) {
          const nextData = this.tryParseNextData(html);
          const buildId: string | null = nextData?.buildId || null;
          // Attempt to derive slug path from the incoming URL
          const match = url.match(/bayut\.com\/(?:en\/)?property\/(.*)$/i);
          if (buildId && match && match[1]) {
            const slugPath = match[1].replace(/\/$/, '');
            const lang = url.includes('/en/') ? 'en' : 'en';
            const jsonUrl = new URL(`/_next/data/${buildId}/${lang}/property/${slugPath}.json`, url).toString();
            const jsonResp = await axios.get<any>(jsonUrl, { headers, timeout: 20000, validateStatus: () => true });
            if (jsonResp.status < 400 && jsonResp.data) {
              // Try to locate the property object in this JSON
              const propertyRoot = this.deepFindObjectByKey(jsonResp.data, 'property');
              if (propertyRoot) {
                listingData = (propertyRoot && typeof propertyRoot.data === 'object') ? propertyRoot.data : propertyRoot;
              }
            }
          }
        }

        if (!listingData) {
          return {
            success: false,
            source: 'bayut',
            url,
            error: 'Unable to retrieve listing data (window.state/Next.js) without a browser',
          };
        }

        // Extract fields similar to your Python
        let emirate: string | null = null;
        let main_area: string | null = null;
        let sub_area: string | null = null;
        let sub_sub_area: string | null = null;
        const locationLevels: any[] = Array.isArray(listingData.location) ? listingData.location : [];
        for (const loc of locationLevels) {
          const level = loc?.level;
          const name = loc?.name;
          if (level === 1) emirate = name || emirate;
          else if (level === 2) main_area = name || main_area;
          else if (level === 3) sub_area = name || sub_area;
          else if (level === 4) sub_sub_area = name || sub_sub_area;
        }

        const agencyName: string | null = listingData?.agency?.name || null;
        const geography = listingData?.geography || {};
        const portal_lat = typeof geography.lat !== 'undefined' ? geography.lat : null;
        const portal_lng = typeof geography.lng !== 'undefined' ? geography.lng : null;
        const portal_gmap = portal_lat != null && portal_lng != null ? `https://maps.google.com/?q=${portal_lat},${portal_lng}` : null;

        const permitNumber: string | null = listingData?.permitNumber || null;

        // Extract trakheesi validation URL from HTML
        // Try to get a direct anchor to Trakheesi link if present
        let trakheesiUrl = this.extractTrakheesiUrlFromHtml(html);
        if (!trakheesiUrl) {
          const $ = cheerio.load(html);
          const anchorHref = $('a[href*="trakheesi.dubailand.gov.ae/rev/madmoun/listing/validation"]').attr('href');
          if (anchorHref) trakheesiUrl = anchorHref.startsWith('http') ? anchorHref : `https://${anchorHref.replace(/^\/\//, '')}`;
        }
        // Zone Name from HTML (fallback to listingData if exists under another key)
        const zoneNameHtml = this.extractBayutZoneNameFromHtml(html);

        // Beds/Baths (Bayut: property.data.rooms, property.data.baths)
        const bedroomsValue: number | null =
          typeof listingData?.rooms === 'number' ? listingData.rooms : this.deepFindFirstNumberByKey(listingData, 'rooms');
        const bathroomsValue: number | null =
          typeof listingData?.baths === 'number' ? listingData.baths : this.deepFindFirstNumberByKey(listingData, 'baths');

        // Photos: property.data.photos[].url → first only, unescape and fetch base64
        let imageSmallUrl: string | null = null;
        if (Array.isArray(listingData?.photos) && listingData.photos.length > 0) {
          const raw = listingData.photos[0]?.url;
          if (typeof raw === 'string') imageSmallUrl = this.decodeEscapedUrl(raw);
        }
        let imageSmallBase64: string | null = null;
        if (imageSmallUrl && imageSmallUrl.startsWith('http')) {
          imageSmallBase64 = await this.fetchImageAsBase64(imageSmallUrl, url);
        }

        // Price and plot area
        const price: number | null = typeof listingData?.price === 'number' ? listingData.price : null;
        const plotArea: number | null = typeof listingData?.plotArea === 'number' ? listingData.plotArea : null;

        const resultPayload = {
          success: true,
          source: 'bayut',
          url,
          location: {
            full_name: null,
            emirate,
            main_area,
            sub_area,
            sub_sub_area,
          },
          coordinates:
            portal_lat != null && portal_lng != null
              ? { lat: Number(portal_lat), lon: Number(portal_lng), gmap: portal_gmap }
              : null,
          rera: {
            permit_number: permitNumber,
            permit_url: trakheesiUrl || null,
          },
          property: {
            zone_name: zoneNameHtml || null,
            bedrooms_value: bedroomsValue ?? null,
            bathrooms_value: bathroomsValue ?? null,
            image_small_url: imageSmallUrl,
            image_small_base64: imageSmallBase64,
            price: price,
            plot_area: plotArea,
          },
          company: agencyName || '',
        };

        await this.enrichWithDubaiPulse(resultPayload);

        return resultPayload;
      } catch (error: any) {
        return {
          success: false,
          source: 'bayut',
          url,
          error: error?.message || 'Failed to fetch or parse Bayut page',
        };
      }
    }

    // Unsupported URL for now
    return {
      success: false,
      url,
      error: 'Unsupported URL. Currently only Property Finder URLs are handled.',
    };
  }

  async getFloorplans(url: string): Promise<{ success: boolean; endpoint: string; url: string }> {
    return { 
      success: true, 
      endpoint: 'floorplans',
      url 
    };
  }

  async getOwners(url: string): Promise<{ success: boolean; endpoint: string; url: string }> {
    return { 
      success: true, 
      endpoint: 'owners',
      url 
    };
  }

  async getLiveOwners(url: string): Promise<{ success: boolean; endpoint: string; url: string }> {
    return { 
      success: true, 
      endpoint: 'liveowners',
      url 
    };
  }

  async getCombinedAll(url: string): Promise<{ success: boolean; data: any[] }> {
    const [properties, floorplans, owners] = await Promise.all([
      this.getProperties(url),
      this.getFloorplans(url),
      this.getOwners(url)
    ]);

    return {
      success: true,
      data: [properties, floorplans, owners]
    };
  }

  async getCombinedPropertiesOwners(url: string): Promise<{ success: boolean; data: any[] }> {
    const [properties, owners] = await Promise.all([
      this.getProperties(url),
      this.getOwners(url)
    ]);

    return {
      success: true,
      data: [properties, owners]
    };
  }

  private isPropertyFinderUrl(url: string): boolean {
    return (
      url.startsWith('https://www.propertyfinder.ae/en/plp') ||
      url.startsWith('https://www.propertyfinder.ae/to/')
    );
  }

  private isBayutUrl(url: string): boolean {
    return (
      url.startsWith('https://www.bayut.com/property') ||
      url.startsWith('https://www.bayut.com/en/property')
    );
  }

  private buildDesktopHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    };
  }

  private looksLikeBotBlock(html: string): boolean {
    const indicators = [
      'cf-browser-verification',
      'Attention Required! | Cloudflare',
      'Please verify you are a human',
      'Just a moment...',
    ];
    const lowered = html.toLowerCase();
    return indicators.some((s) => lowered.includes(s.toLowerCase()));
  }

  private tryParseNextData(html: string): any | null {
    const $ = cheerio.load(html);
    const script = $('#__NEXT_DATA__');
    if (!script || script.length === 0) return null;
    const content = script.html();
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private extractWindowStateFromHtml(html: string): any | null {
    // Find <script>window.state = { ... }</script> and JSON-parse the object using brace matching
    const scriptMatch = html.match(/<script[^>]*>\s*window\.state\s*=\s*/i);
    if (!scriptMatch) return null;
    const startIndex = html.indexOf('{', scriptMatch.index! + scriptMatch[0].length);
    if (startIndex === -1) return null;
    let depth = 0;
    let i = startIndex;
    let inString = false;
    let stringDelim = '';
    let escaped = false;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === stringDelim) {
          inString = false;
        }
        continue;
      }
      if (ch === '"' || ch === '\'') {
        inString = true;
        stringDelim = ch;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonText = html.slice(startIndex, i + 1);
          try {
            return JSON.parse(jsonText);
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  private extractTrakheesiUrlFromHtml(html: string): string | null {
    // Full URL first
    let m = html.match(/https?:\/\/(?:www\.)?trakheesi\.dubailand\.gov\.ae\/rev\/madmoun\/listing\/validation\?khevJujtDig=[A-Za-z0-9_-]+/);
    if (m && m[0]) return m[0];
    // Without scheme
    m = html.match(/(?:www\.)?trakheesi\.dubailand\.gov\.ae\/rev\/madmoun\/listing\/validation\?khevJujtDig=[A-Za-z0-9_-]+/);
    if (m && m[0]) return `https://${m[0]}`;
    // Fallback: anchor text search
    try {
      const $ = cheerio.load(html);
      const anchorByText = $('a').filter((_, el) => /trakheesi\s+permit/i.test($(el).text())).first();
      const href = anchorByText.attr('href');
      if (href) return href.startsWith('http') ? href : `https://${href.replace(/^\/\//, '')}`;
    } catch {}
    return null;
  }

  private extractBayutZoneNameFromHtml(html: string): string | null {
    // Try DOM-based approach prioritizing label text over classes
    try {
      const $ = cheerio.load(html);
      let found: string | null = null;

      $('li').each((_, li) => {
        if (found) return;
        const labelText = $(li).find('div,span,strong').first().text().trim();
        if (/^zone\s*name$/i.test(labelText)) {
          // Grab the first span text within this li
          const candidate = $(li).find('span').filter((_, s) => $(s).text().trim().length > 0).first().text().trim();
          if (candidate) {
            found = candidate;
          }
        }
      });
      if (found) return found;

      // Fallback: regex over HTML snippet around Zone Name label
      const rx = /Zone\s*Name[\s\S]{0,300}?<span[^>]*>([^<]+)<\/span>/i;
      const mx = html.match(rx);
      if (mx && mx[1]) return mx[1].trim();
    } catch {}
    return null;
  }

  private decodeEscapedUrl(urlStr: string): string {
    try {
      // Replace \u002F with /
      const unescaped = urlStr.replace(/\\u002F/g, '/');
      return unescaped;
    } catch {
      return urlStr;
    }
  }

  private splitLocation(
    fullName: string | null,
  ): { emirate: string | null; main_area: string | null; sub_area: string | null; sub_sub_area: string | null } {
    if (!fullName) {
      return { emirate: null, main_area: null, sub_area: null, sub_sub_area: null };
    }
    const parts = fullName.split(',').map((p) => p.trim()).reverse();
    return {
      emirate: parts[0] || null,
      main_area: parts[1] || null,
      sub_area: parts[2] || null,
      sub_sub_area: parts[3] || null,
    };
  }

  private deepFindFirstStringByKey(obj: any, keyName: string): string | null {
    let result: string | null = null;
    const visit = (val: any): void => {
      if (result !== null) return;
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          if (k === keyName && typeof v === 'string') {
            result = v;
            return;
          }
          visit(v);
          if (result !== null) return;
        }
      }
    };
    visit(obj);
    return result;
  }

  private deepFindObjectByKey(obj: any, keyName: string): any | null {
    let result: any | null = null;
    const visit = (val: any): void => {
      if (result !== null) return;
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          if (k === keyName && v && typeof v === 'object') {
            result = v;
            return;
          }
          visit(v);
          if (result !== null) return;
        }
      }
    };
    visit(obj);
    return result;
  }

  private deepFindObjectWithKeys(obj: any, keys: string[]): any | null {
    let result: any | null = null;
    const hasAllKeys = (o: any): boolean => keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));
    const visit = (val: any): void => {
      if (result !== null) return;
      if (val && typeof val === 'object') {
        if (hasAllKeys(val)) {
          result = val;
          return;
        }
        for (const v of Object.values(val)) {
          visit(v);
          if (result !== null) return;
        }
      }
    };
    visit(obj);
    return result;
  }

  private getValueAtPath(root: any, path: Array<string | number>): any {
    let current: any = root;
    for (const key of path) {
      if (current == null) return undefined;
      current = (typeof key === 'number' ? current?.[key] : current?.[key as any]);
    }
    return current;
  }

  private deepFindFirstNumberByKey(obj: any, keyName: string): number | null {
    let result: number | null = null;
    const visit = (val: any): void => {
      if (result !== null) return;
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          if (k === keyName && typeof v === 'number') {
            result = v;
            return;
          }
          visit(v);
          if (result !== null) return;
        }
      }
    };
    visit(obj);
    return result;
  }

  private deepFindFirstUrlByKey(obj: any, keyName: string): string | null {
    let result: string | null = null;
    const isUrl = (s: string) => /^https?:\/\//i.test(s);
    const visit = (val: any): void => {
      if (result !== null) return;
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          if (k === keyName && typeof v === 'string' && isUrl(v)) {
            result = v;
            return;
          }
          visit(v);
          if (result !== null) return;
        }
      }
    };
    visit(obj);
    return result;
  }

  private findFirstSmallImage(propertyRoot: any): string | null {
    if (!propertyRoot || typeof propertyRoot !== 'object') return null;
    // Expected path: property.images.property[].small
    const imagesContainer = propertyRoot.images && propertyRoot.images.property;
    if (Array.isArray(imagesContainer) && imagesContainer.length > 0) {
      const first = imagesContainer[0];
      if (first && typeof first.small === 'string') return first.small;
    }
    return null;
  }

  private async fetchImageAsBase64(imageUrl: string, refererUrl: string): Promise<string | null> {
    try {
      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          ...this.buildDesktopHeaders(),
          Referer: refererUrl,
        },
        validateStatus: () => true,
      });
      if (response.status >= 400) return null;
      const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
      const base64 = Buffer.from(response.data).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch {
      return null;
    }
  }

  private normalizePermitAndType(permitNumberRaw: string | null): { type: 'building' | 'land' | 'unit' | null; propertyId: string | null } {
    if (!permitNumberRaw) return { type: null, propertyId: null };
    const trimmed = String(permitNumberRaw).replace(/\D+/g, '');
    if (trimmed.length < 3) return { type: null, propertyId: null };
    const prefix = trimmed.slice(0, 2);
    let type: 'building' | 'land' | 'unit' | null = null;
    if (prefix === '69') type = 'building';
    else if (prefix === '65') type = 'land';
    else if (trimmed.startsWith('7')) type = 'unit';
    const propertyId = trimmed.slice(2); // drop first two digits
    return { type, propertyId };
  }

  private generatePropertyIdCandidates(propertyId: string): string[] {
    const candidates: string[] = [];
    let current = propertyId.replace(/\D+/g, '');
    // Push full first
    if (current.length > 0) candidates.push(current);
    // Iteratively trim ONE trailing zero at a time, appending each candidate
    while (current.endsWith('0')) {
      current = current.slice(0, -1);
      if (current.length > 0) candidates.push(current);
      else break;
    }
    return candidates;
  }

  private async enrichWithDubaiPulse(result: any): Promise<void> {
    try {
      const permitNumber = result?.rera?.permit_number || null;
      // IMPORTANT: Only use zone_name for area filtering. If zone_name is null, skip area filters entirely
      const areaNameEn: string | null = result?.property?.zone_name ?? null;
      const { type, propertyId } = this.normalizePermitAndType(permitNumber);
      if (!propertyId) return;

      const pool = this.getDubaiPulsePool();

      const candidates = this.generatePropertyIdCandidates(propertyId);

      for (const candidateId of candidates) {
        // 1) Try allpropmon for first hit (match area if available; otherwise by property_id only)
        let apmRes;
        if (areaNameEn && areaNameEn.trim().length > 0) {
          apmRes = await pool.query({
            text: 'SELECT sub_title, unit_number FROM allpropmon WHERE property_id = $1 AND area_name_en = $2 LIMIT 1',
            values: [candidateId, areaNameEn],
          });
        } else {
          apmRes = await pool.query({
            text: 'SELECT sub_title, unit_number FROM allpropmon WHERE property_id = $1 LIMIT 1',
            values: [candidateId],
          });
        }
        if (apmRes.rows.length > 0) {
          const row = apmRes.rows[0];
          result.buildingName = row.sub_title || null;
          result.unitNumber = row.unit_number || null;
          return;
        }

        // 2) Fall back by type
        if (type === 'building') {
          const text = areaNameEn && areaNameEn.trim().length > 0
            ? 'SELECT project_name_en, building_number FROM buildings WHERE property_id = $1 AND area_name_en = $2 AND migrated = true LIMIT 1'
            : 'SELECT project_name_en, building_number FROM buildings WHERE property_id = $1 AND migrated = true LIMIT 1';
          const values = areaNameEn && areaNameEn.trim().length > 0 ? [candidateId, areaNameEn] : [candidateId];
          const r = await pool.query({ text, values });
          if (r.rows.length > 0) {
            const row = r.rows[0];
            const project = row.project_name_en ? String(row.project_name_en).trim() : '';
            const buildingNum = row.building_number ? String(row.building_number).trim() : '';
            const combined = project ? `${project} - ${buildingNum}` : buildingNum || null;
            result.buildingName = combined;
            result.unitNumber = null;
            return;
          }
        } else if (type === 'land') {
          const text = areaNameEn && areaNameEn.trim().length > 0
            ? 'SELECT pre_registration_number, land_number FROM land_registry WHERE property_id = $1 AND area_name_en = $2 AND migrated = true LIMIT 1'
            : 'SELECT pre_registration_number, land_number FROM land_registry WHERE property_id = $1 AND migrated = true LIMIT 1';
          const values = areaNameEn && areaNameEn.trim().length > 0 ? [candidateId, areaNameEn] : [candidateId];
          const r = await pool.query({ text, values });
          if (r.rows.length > 0) {
            const row = r.rows[0];
            const pre = row.pre_registration_number ? String(row.pre_registration_number).trim() : '';
            const landNum = row.land_number ? String(row.land_number).trim() : '';
            const combined = pre ? `${pre} - Land Number: ${landNum}` : landNum || null;
            result.buildingName = combined;
            result.unitNumber = null;
            return;
          }
        } else if (type === 'unit') {
          const text = areaNameEn && areaNameEn.trim().length > 0
            ? 'SELECT building_name_en, unit_number FROM units WHERE property_id = $1 AND area_name_en = $2 AND migrated = true LIMIT 1'
            : 'SELECT building_name_en, unit_number FROM units WHERE property_id = $1 AND migrated = true LIMIT 1';
          const values = areaNameEn && areaNameEn.trim().length > 0 ? [candidateId, areaNameEn] : [candidateId];
          const r = await pool.query({ text, values });
          if (r.rows.length > 0) {
            const row = r.rows[0];
            result.buildingName = row.building_name_en || null;
            result.unitNumber = row.unit_number || null;
            return;
          }
        }
      }
    } catch (e) {
      // Silent enrichment failure; continue
    }
  }
}