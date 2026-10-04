import { createId } from '../ids.ts'
import { SCHEMA_VERSION } from './schema.ts'
import type { BoardDoc } from './types.ts'

/**
 * 默认便签卡，写使用说明：新用户一进来就知道这个看板怎么用。
 */
const WELCOME_MEMO_1 = `# 这个网页是做什么的？
一个适用于 [《最终幻想14》](https://ff.web.sdo.com/) 的导航站。
可以自定义编辑多项内容：
- 添加自定义链接
- 可选的组件
- 快速搜索
- 主题设置
`
const WELCOME_MEMO_2 = `# 快速上手
- **编辑看板**：先点顶栏的铅笔图标进入编辑模式，然后点击顶栏「＋」新建分组，再点击分组标题栏的「＋」往组里添加**组件**或**链接**。
- **拖拽排序**：编辑模式下拖动卡片左上角的手柄即可调整顺序。
- **全局搜索**：按 \`Tab\` 唤起搜索，输入关键词后回车打开链接。
- **系统设置**：点击顶栏的齿轮图标可进入设置，进行切换主题、管理搜索、添加链接、导入／导出数据等等。
`

const WELCOME_MEMO_3 = `# 如何添加组件？
> **组件**和**链接**需要分别放置在对应的分组中，比如「欢迎使用」是一个**组件分组**，「常用链接」则是一个**链接分组**。
1. 点击顶栏的铅笔图标进入编辑模式。
2. 点击编辑模式下顶栏出现的「＋」按钮添加一个**组件分组**（如果已有**组件分组**，则可以跳过此步）。
3. 点击**组件分组**标题栏的「＋」按钮，选择并添加**组件**。
`

const WELCOME_MEMO_4 = `# 如何添加自定义链接？
> **链接**和**组件**需要分别放置在对应的分组中，比如「常用链接」是一个**链接分组**，「欢迎使用」则是一个**组件分组**。
- **添加单项**：点击顶栏的铅笔图标进入编辑模式，再点击**链接分组**的「＋」按钮添加。
- **批量添加**：点击顶栏的齿轮图标进入设置，在「批量添加链接」中可一次性输入最多 20 个链接进行批量添加。
`

const WELCOME_MEMO_5 = `# 如何搜索？
> 「搜索」可以在已保存的链接中进行快速查找、访问；也可以输入关键词，通过访问搜索引擎进行搜索。
- **打开搜索**：按 \`Tab\` 键，或点击顶栏搜索框可唤起弹窗。
- **快速访问**：在页面中，输入任意字符即可唤起搜索弹窗，或是直接 \`Ctrl+V\` 粘贴剪贴板内容。
- **搜索引擎**：点击顶栏的齿轮图标，在「搜索引擎」中启用或配置。
`

const WELCOME_MEMO_6 = `# 如何配置主题？
- 点击顶栏的齿轮图标进入设置，可在「外观」中配置浅色/深色模式，也可以选择跟随系统进行切换。
- 深色或浅色模式可各选择一套主题，默认使用最简洁的「默认-浅色」和「默认-深色」。
- 在设置的「主题编辑」中，可对每个主题进行单独配置，修改背景、透明度、模糊等参数。
`

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
        title: '欢迎使用',
        type: 'widget',
        columns: 3,
        items: [
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_1 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_2 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_3 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_4 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_5 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'memo',
            title: '便签',
            config: { text: WELCOME_MEMO_6 },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'pvp-map',
            title: 'PvP 地图轮换',
            config: { showNextMap: true },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'todo',
            title: '待办',
            config: { 
              cycle: 'tue', time: '16:00', 
              items: '天书\n幻巧战\n黄金的试炼\n神典石\n时尚品鉴\n每周六仙人彩\n老主顾\n无人岛\n深宫挑战笔记'
             },
          },
          {
            id: createId(),
            kind: 'widget',
            widget: 'aurora',
            title: '极光预报',
            config: { zone: 'all' },
          },
        ],
      },
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
            icon: 'https://ff.web.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '活动中心',
            url: 'https://actff1.web.sdo.com/Project/20181018ffactive/index.html',
            desc: '查看最新活动',
            icon: 'https://actff1.web.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '道具商城',
            url: 'https://qu.sdo.com/tools-shop?merchantId=1',
            desc: '买买买',
            icon: 'https://qu.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '超域传送',
            url: 'https://ff14bjz.sdo.com/RegionKanTelepo?',
            desc: '跨区游玩',
            icon: 'https://ff14bjz.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '石之家',
            url: 'https://ff14risingstones.web.sdo.com/pc/index.html#/post',
            desc: '官方社区',
            icon: 'https://ff14risingstones.web.sdo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '最终幻想XIV 中文维基',
            url: 'https://ff14.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5',
            desc: '游戏百科',
            icon: 'https://av.huijiwiki.com/site_avatar_ff14_l.png',
          },
          {
            id: createId(),
            kind: 'link',
            name: '素素攻略站',
            url: 'https://www.ffxiv.cn/v2/',
            desc: '攻略以及小工具',
            icon: 'https://www.ffxiv.cn/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '新大陆见闻录',
            url: 'https://ff14.org/',
            desc: '新人帮手',
            icon: 'https://ff14.org/favicon.ico',
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
            desc: '',
            icon: 'https://weibo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '哔哩哔哩',
            url: 'https://space.bilibili.com/6655514',
            desc: '',
            icon: 'https://www.bilibili.com/favicon.ico',
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
            icon: 'https://www.douyin.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '周边商城微博',
            url: 'https://weibo.com/u/7285749323',
            desc: '',
            icon: 'https://weibo.com/favicon.ico',
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
            icon: 'https://weibo.com/favicon.ico',
          },
          {
            id: createId(),
            kind: 'link',
            name: '清凉的小丝瓜',
            url: 'https://space.bilibili.com/48648/dynamic',
            desc: '',
            icon: 'https://www.bilibili.com/favicon.ico',
          },
        ],
      },
    ],
  }
}
