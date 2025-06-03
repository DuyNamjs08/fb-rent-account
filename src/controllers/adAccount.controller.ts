import roleService from '../services/Roles.service';
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import UserService from '../services/User.service';
import prisma from '../config/prisma';
import axios from 'axios';
import { decryptToken } from './facebookBm.controller';
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
const TKQCController = {
  createRole: async (req: Request, res: Response): Promise<void> => {
    try {
      const roleNameExist = await roleService.getRoleByName(req.body.name);
      if (roleNameExist) {
        errorResponse(
          res,
          'Quyền đã tồn tại!',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const role = await roleService.createRole(req.body.name);
      successResponse(res, 'Tạo quyền thành công', role);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  asyncTKQC: async (req: Request, res: Response): Promise<void> => {
    try {
      const { bm_id = '' } = req.body;
      console.log('bm_id', bm_id);
      if (!bm_id) {
        errorResponse(
          res,
          'Dữ liệu không hợp lệ hoặc rỗng',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const systemUserToken = await prisma.facebookBM.findUnique({
        where: {
          bm_id,
        },
      });
      if (!systemUserToken) {
        errorResponse(
          res,
          'Không tìm thấy bm hợp lệ',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const systemUserDecode = await decryptToken(
        systemUserToken.system_user_token,
      );
      if (!systemUserDecode) {
        errorResponse(
          res,
          'Có lỗi xảy ra decode',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      let totalCount = 0;
      let afterCursor = '';
      const baseUrl = `https://graph.facebook.com/v17.0/${bm_id}/owned_ad_accounts`;
      const fields = [
        'name',
        'account_id',
        'account_status',
        'users',
        'balance',
        'currency',
        'capabilities',
        'business_city',
        'business_country_code',
        'business_name',
        'business_state',
        'business_street',
        'business_street2',
        'business_zip',
        'can_create_brand_lift_study',
        'created_time',
        'custom_audience_info',
        'brand_safety_content_filter_levels',
        'user_tasks',
        'owner',
        'partner',
        'business',
        'amount_spent',
        'agency_client_declaration',
        'spend_cap',
        'min_campaign_group_spend_cap',
        'min_daily_budget',
        'disable_reason',
        'timezone_name',
        'timezone_offset_hours_utc',
        'is_personal',
        'is_prepay_account',
        'tax_id',
        'tax_id_status',
        'account_controls',
        'age',
        'attribution_spec',
        'default_dsa_beneficiary',
        'default_dsa_payor',
        'end_advertiser',
        'end_advertiser_name',
        'existing_customers',
        'expired_funding_source_details',
        'extended_credit_invoice_group',
        'fb_entity',
        'media_agency',
        'funding_source',
        'funding_source_details',
        'has_migrated_permissions',
        'io_number',
        'is_attribution_spec_system_default',
        'is_direct_deals_enabled',
        'is_in_3ds_authorization_enabled_market',
        'is_notifications_enabled',
        'line_numbers',
        'offsite_pixels_tos_accepted',
        'tos_accepted',
        'user_tos_accepted',
      ].join(',');
      let hasNextPage = true;

      while (hasNextPage) {
        let url = `${baseUrl}?fields=${fields}&limit=20&access_token=${systemUserDecode}`;
        if (afterCursor) {
          url += `&after=${afterCursor}`;
        }
        const listdata = await axios.get(url);
        if (listdata.status !== 200) {
          errorResponse(
            res,
            'Lỗi đồng bộ từ facebook',
            {},
            httpStatusCodes.BAD_REQUEST,
          );
          return;
        }
        const arrayResult = listdata.data.data;
        if (Array.isArray(arrayResult)) {
          try {
            await Promise.all(
              arrayResult.map((item: any) =>
                prisma.adsAccount.upsert({
                  where: { id: item.id },
                  update: mapItemToAdsAccount(item),
                  create: mapItemToAdsAccount(item),
                }),
              ),
            );
          } catch (err: any) {
            console.error('Failed to post to server:', err.message);
          }
          totalCount += arrayResult.length;
        }
        afterCursor = listdata.data.paging?.cursors?.after || '';
        hasNextPage = !!afterCursor;
        console.log('Next cursor >>>', afterCursor);
      }
      console.log('Total synced:', totalCount);
      successResponse(res, 'Danh sách đồng bộ', {});
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getAllTKQC: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = req.query;
      const { pageSize = 10, page = 1 } = data;
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const result = await prisma.adsAccount.findMany({
        where: {},
        skip,
        take: pageSizeNum,
      });
      successResponse(res, 'Danh sách tkqc', result);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getRoleById: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      successResponse(res, 'Success', role);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  updateRole: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const roleNew = await roleService.updateRole(req.params.id, req.body);
      successResponse(res, 'Cập nhật quyền thành công !', roleNew);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },

  deleteRole: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, {}, 404);
        return;
      }
      const users = await UserService.getUserByRoleId(req.params.id);
      await Promise.all(users.map((item) => UserService.deleteUser(item.id)));
      await roleService.deleteRole(req.params.id);
      successResponse(res, 'Xóa quyền thành công !', role);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },
};

export default TKQCController;
