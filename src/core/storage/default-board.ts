import { createId } from '../ids.ts'
import { SCHEMA_VERSION } from './schema.ts'
import type { BoardDoc } from './types.ts'

/**
 * 初始演示数据。
 *
 * 组件配置统一收在各组件的 config 里（chips 是字符串数组，不是斜杠字符串）。
 *
 * 写成函数：每次调用都产出全新的 id，避免模块级副作用。
 *
 * `version` 直接引用 SCHEMA_VERSION 而不写死数字：`sanitizeBoardDoc` 在版本对不上时
 * 会把整份数据判死并回退到这里，两者一旦不同步就会陷入
 * “每次刷新都静默重置为演示数据”的循环（详见 schema.ts 里 SCHEMA_VERSION 的注释）。
 */
export function createDefaultBoard(): BoardDoc {
  return {
    version: SCHEMA_VERSION,
    groups: [
      {
        id: createId(),
        title: '常用链接',
        type: 'link',
        columns: 4,
        items: [
          {
            id: createId(),
            kind: 'link',
            name: '官网新闻',
            url: 'https://ff.web.sdo.com/web8/index.html#/simple',
            desc: '官方新闻公告',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '活动中心',
            url: 'https://actff1.web.sdo.com/Project/20181018ffactive/index.html',
            desc: '查看最新活动',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '道具商城',
            url: 'https://qu.sdo.com/tools-shop?merchantId=1',
            desc: '买买买',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '超域传送',
            url: 'https://ff14bjz.sdo.com/RegionKanTelepo?',
            desc: '跨区游玩',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '石之家',
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/post',
            desc: '官方社区',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '最终幻想XIV 中文维基',
            url: 'https://ff14.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5',
            desc: '游戏百科',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '素素攻略站',
            url: 'https://www.ffxiv.cn/v2/',
            desc: '攻略以及小工具',
            icon: '',
          },
          {
            id: createId(),
            kind: 'link',
            name: '新大陆见闻录',
            url: 'https://ff14.org/',
            desc: '新人帮手',
            icon: '',
          },
        ],
      },
      {
        id: createId(),
        title: '消费充值',
        type: 'link',
        columns: 4,
        items: [
          { 
            id: createId(),
            kind: 'link',
            name: '游戏充值',
            url: 'https://pay.sdo.com/item/GWPAY-100001900', 
            desc: '',
            icon: '🕹️',
          },
          {
            id: createId(),
            kind: 'link',
            name: '道具商城',
            url: 'https://qu.sdo.com/tools-shop?merchantId=1',
            desc: '',
            icon: '🛒',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '道具仓库', 
            url: 'https://qu.sdo.com/personal-center?merchantId=1#itemindex-100001900-1', 
            desc: '', 
            icon: '📦',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '周边商城', 
            url: 'https://qu.sdo.com/surround-shop?merchantId=1', 
            desc: '', 
            icon: '🛍️',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '积分商城', 
            url: 'https://qu.sdo.com/unit-shop?merchantId=1', 
            desc: '', 
            icon: '🎟️',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '后勤补给站', 
            url: 'https://actff1.web.sdo.com/project/141028dgf/index.html', 
            desc: '', 
            icon: '🚚',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '陆行鸟礼物站', 
            url: 'https://ffpay.sdo.com/pc/giftsStation/index.html#/index', 
            desc: '', 
            icon: '🎁',
          },
        ],
      },
      {
        id: createId(),
        title: '石之家',
        type: 'link',
        columns: 4,
        items: [
          { 
             id: createId(),
             kind: 'link',
             name: '幻化（光之收藏家）',
             url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/glamour', 
             desc: '',
             icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '投影外观数据', 
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/statistics/glamour', 
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(),
             kind: 'link',
             name: '副本招募',
             url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/recruit/party', 
             desc: '',
             icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '萌新招待',
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/recruit/beginner',
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '纷争前线数据', 
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/statistics/frontline', 
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '捕鱼人数据', 
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/statistics/fishing', 
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '零式数据', 
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/statistics/savage', 
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '绝境战数据', 
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/statistics/ultimate', 
            desc: '',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
        ],
      },
      {
        id: createId(),
        title: '官方账号',
        type: 'link',
        columns: 4,
        items: [
          { 
             id: createId(),
             kind: 'link',
             name: '微博',
             url: 'https://weibo.com/cnff14', 
             desc: '' 
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '哔哩哔哩', 
            url: 'https://space.bilibili.com/6655514', 
            desc: '', 
          },
          { 
            id: createId(),
             kind: 'link',
             name: '小红书',
             url: 'https://www.xiaohongshu.com/user/profile/5f814cbe0000000001003455', 
             desc: '',
             icon: 'https://fe-video-qc.xhscdn.com/fe-platform/ed8fe781ce9e16c1bfac2cd962f0721edabe2e49.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '抖音',
            url: 'https://www.douyin.com/user/MS4wLjABAAAAHJts6kVkO7Lob9_H5VMSc3UZXCSq6gw5s02kplXQ7k0',
            desc: '',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '周边商城微博', 
            url: 'https://weibo.com/u/7285749323', 
            desc: '', 
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '彩虹客服', 
            url: 'https://qryai.crm.sdo.com/?gameId=100001900&q=&gamename=最终幻想14&s=webh5', 
            desc: '', 
            icon: 'https://qryai.crm.sdo.com/icon/iconlogo.png',
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '海德林咖啡餐厅', 
            url: 'https://weibo.com/u/6597795076', 
            desc: '', 
          },
          { 
            id: createId(), 
            kind: 'link', 
            name: '清凉的小丝瓜', 
            url: 'https://space.bilibili.com/48648/dynamic', 
            desc: '', 
          },
        ],
      },
    ],
  }
}
