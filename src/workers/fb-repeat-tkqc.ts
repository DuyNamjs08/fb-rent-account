import Bull from 'bull';
import prisma from '../config/prisma';

export const fbRealtimeTKQC = new Bull('fbRealtimeTKQC', {
  redis: { port: 6380, host: 'localhost' },
  limiter: {
    max: 50, // tối đa 50 job
    duration: 1000, // mỗi 1000ms
  },
});
export function escape(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value))
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  if (typeof value === 'object')
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return value.toString();
}

export function buildInsertQuery(table: string, data: any[]) {
  const fields = Object.keys(data[0]);
  const valuesSQL = data
    .map((obj) => `(${fields.map((f) => escape(obj[f])).join(', ')})`)
    .join(',\n');

  const updateSQL = fields
    .filter((f) => f !== 'id')
    .map((f) => `"${f}" = EXCLUDED."${f}"`)
    .join(', ');

  return `
    INSERT INTO "${table}" (${fields.map((f) => `"${f}"`).join(', ')})
    VALUES ${valuesSQL}
    ON CONFLICT ("id") DO UPDATE SET
    ${updateSQL};
  `;
}
function mapItemToAdsAccount(item: any) {
  return {
    id: item.id,
    account_id: item.account_id,
    account_status: item.account_status,
    amount_spent: item.amount_spent,
    balance: item.balance,
    business: item.business,
    currency: item.currency ?? 'VND',
    created_time: item.created_time,
    disable_reason: item.disable_reason,
    name: item.name,
    spend_cap: item.spend_cap,
    timezone_name: item.timezone_name,
    timezone_offset_hours_utc: item.timezone_offset_hours_utc,
    owner: item.owner,
    is_personal: item.is_personal,
    is_prepay_account: item.is_prepay_account,
    tax_id: item.tax_id,
    tax_id_status: item.tax_id_status,
    account_controls: item.account_controls,
    users: item.users ?? [],
    ad_account_promotable_objects: item.ad_account_promotable_objects,
    age: item.age,
    agency_client_declaration: item.agency_client_declaration,
    attribution_spec: item.attribution_spec,
    brand_safety_content_filter_levels:
      item.brand_safety_content_filter_levels ?? [],
    business_city: item.business_city,
    business_country_code: item.business_country_code,
    business_name: item.business_name,
    business_state: item.business_state,
    business_street: item.business_street,
    business_street2: item.business_street2,
    business_zip: item.business_zip,
    can_create_brand_lift_study: item.can_create_brand_lift_study,
    capabilities: item.capabilities ?? [],
    custom_audience_info: item.custom_audience_info,
    default_dsa_beneficiary: item.default_dsa_beneficiary,
    default_dsa_payor: item.default_dsa_payor,
    direct_deals_tos_accepted: item.direct_deals_tos_accepted,
    end_advertiser: item.end_advertiser,
    end_advertiser_name: item.end_advertiser_name,
    existing_customers: item.existing_customers ?? [],
    expired_funding_source_details: item.expired_funding_source_details,
    extended_credit_invoice_group: item.extended_credit_invoice_group,
    failed_delivery_checks: item.failed_delivery_checks,
    fb_entity: item.fb_entity,
    funding_source: item.funding_source,
    funding_source_details: item.funding_source_details,
    has_migrated_permissions: item.has_migrated_permissions,
    has_page_authorized_adaccount: item.has_page_authorized_adaccount,
    io_number: item.io_number,
    is_attribution_spec_system_default: item.is_attribution_spec_system_default,
    is_direct_deals_enabled: item.is_direct_deals_enabled,
    is_in_3ds_authorization_enabled_market:
      item.is_in_3ds_authorization_enabled_market,
    is_notifications_enabled: item.is_notifications_enabled,
    line_numbers: item.line_numbers ?? [],
    media_agency: item.media_agency,
    min_campaign_group_spend_cap: item.min_campaign_group_spend_cap,
    min_daily_budget: item.min_daily_budget,
    offsite_pixels_tos_accepted: item.offsite_pixels_tos_accepted,
    partner: item.partner,
    rf_spec: item.rf_spec,
    show_checkout_experience: item.show_checkout_experience,
    tax_id_type: item.tax_id_type,
    tos_accepted: item.tos_accepted,
    user_tasks: item.user_tasks ?? [],
    user_tos_accepted: item.user_tos_accepted,
    vertical_name: item.vertical_name,
  };
}
const updateDb = async (data: any) => {
  try {
    const { list } = data;
    const result = await Promise.all(
      list.map((item: any) =>
        prisma.adsAccount.upsert({
          where: { id: item.id },
          update: mapItemToAdsAccount(item),
          create: mapItemToAdsAccount(item),
        }),
      ),
    );
    return result;
  } catch (fallbackError) {
    console.error('❌ Lỗi khi ghi transaction lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbRealtimeTKQC.process(15, async (job) => {
  const { data } = job;
  try {
    console.log('data tkqc', data);
    const res = await updateDb(data);
    console.log(`✅ Cập nhật thành công danh sách tkqc`);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật danh sách tkqc`, err);
    throw err;
  }
});
