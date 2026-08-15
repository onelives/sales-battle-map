// ============================================================
//  客户数据文件 —— 作战图配置 + 本地示例数据
// ------------------------------------------------------------
//  【架构】前端 ─▶ 后端中转（QW Pages 动态页 / server/）─▶ 探迹开放平台
//                              ├─▶ 天眼查/爱企查（自动回填/动态补全）
//                              └─▶ Neon Serverless PostgreSQL（批量写入）
//  ⚠️ 探迹密钥与 Neon 连接串仅存后端；前端零密钥。
//  ⚠️ 无后端时前端运行"模拟模式"：自动回填/线索挖掘均为模拟并明确标注。
//
//  【表单字段（添加客户）】
//  name* 客户名称        keyAccount 是否重点(是/否)   industry 赛道标签
//  website 公司网站      address* 公司地址           contact* 法人/联系人
//  phone 法人电话        otherContacts 其他关键人联系方式
//  contacted 建联情况(已建联/未建联)   pcCount 公司PC人数  rdCount 研发人数
//  accessMode 接入方式   monthlySpend 月消费(万)      models 模型种类
//  tools 使用工具        registered 是否注册账号(是/否)
//  region/district 地市/区县（地图用） lat/lng 坐标（地图选点）
// ============================================================

window.BATTLE_DATA = {

  config: {
    // 后端地址；留空 = 自动探测同源 /api（QW Pages 动态页），探测失败 = 本地模拟模式
    relayUrl: ''
  },

  title: '湖北全域 · 51赛道 · 足迹点亮',

  // 湖北省全域鸟瞰
  mapCenter: [30.95, 112.35],
  mapZoom: 7,

  regions: [
    '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州',
    '黄冈', '咸宁', '随州', '恩施州', '仙桃', '潜江', '天门', '神农架'
  ],

  districts: {
    '武汉': ['江岸', '江汉', '硚口', '汉阳', '武昌', '青山', '洪山', '东西湖', '汉南', '蔡甸', '江夏', '黄陂', '新洲'],
    '黄石': ['黄石港区', '西塞山', '下陆', '铁山', '大冶', '阳新'],
    '十堰': ['茅箭', '张湾', '郧阳', '房县', '竹溪', '竹山', '丹江口', '郧西'],
    '宜昌': ['西陵', '伍家岗', '点军', '猇亭', '夷陵', '远安', '兴山', '秭归', '长阳', '五峰', '宜都', '枝江', '当阳'],
    '襄阳': ['襄城', '樊城', '襄州', '南漳', '谷城', '保康', '老河口', '枣阳', '宜城'],
    '鄂州': ['鄂城区', '华容', '梁子湖'],
    '荆门': ['东宝', '掇刀', '京山', '沙洋', '钟祥'],
    '孝感': ['孝南', '应城', '安陆', '汉川', '孝昌', '大悟', '云梦'],
    '荆州': ['沙市', '荆州区', '公安', '监利', '江陵', '石首', '洪湖', '松滋'],
    '黄冈': ['黄州', '团风', '红安', '罗田', '英山', '浠水', '蕲春', '黄梅', '麻城', '武穴'],
    '咸宁': ['咸安', '嘉鱼', '通城', '崇阳', '通山', '赤壁'],
    '随州': ['曾都', '随县', '广水'],
    '恩施州': ['恩施市', '利川', '建始', '巴东', '宣恩', '咸丰', '来凤', '鹤峰'],
    '仙桃': ['仙桃'], '潜江': ['潜江'], '天门': ['天门'], '神农架': ['神农架']
  },

  industries: [
    '电商平台', '通用Agent', '金融Agent', '法律Agent', '财务Agent', '健康咨询Agent',
    '游戏制作', 'AI游戏陪玩', '在线教育工具', '社交媒体', '社交陪伴', '视图生产',
    '短漫剧制作', '音频生产', '写作', '搜索', '财务服务', '电商服务', '广告营销',
    'AI Coding', 'AI科研', '医疗健康', '生物识别', 'AI内容安全检测', '舆情风险监测',
    '智能客服', '企业查询服务', '数据服务', '招聘服务', '招投标服务', '智能运维',
    'AI办公', 'CRM服务', '多模型API聚合平台', 'MLOps与大模型运维平台', 'RAG 引擎/平台',
    '基础大模型厂商', '开源模型与工具分发平台', 'AI Agent开发平台', '标注商',
    'AI解决方案商', '具身智能', '智能座舱', '自动驾驶', '智能家电', '智能手机',
    'AI教育', 'AI玩具', 'AI可穿戴设备', 'AI芯片与模组', 'IPCamera'
  ],

  // 接入方式候选
  accessModes: ['API', 'SDK', '私有化部署', '云平台', '未定'],

  // ---------------- 示例客户（本地模拟模式展示用） ----------------
  customers: [
    {
      name: '示例·智算AI解决方案', keyAccount: '是', industry: 'AI解决方案商',
      website: 'https://www.zhisuan-ai.cn', address: '东湖高新区金融港x栋（示例）',
      contact: '王总', phone: '027-00000001', otherContacts: '技术总监 刘工 13800000001',
      contacted: '已建联', pcCount: 120, rdCount: 45, accessMode: 'API',
      monthlySpend: 8, models: '通义/DeepSeek', tools: 'Cursor/Dify', registered: '是',
      region: '武汉', district: '洪山', lat: 30.4652, lng: 114.4305,
      dynamics: '7月新增招聘解决方案架构师；中标政企AI项目',
      source: '自拓', note: '示例数据', sample: true
    },
    {
      name: '示例·元界智能座舱', keyAccount: '是', industry: '智能座舱',
      website: 'https://www.yuanjie-auto.com', address: '东湖高新区鼎创国际x层（示例）',
      contact: '李总', phone: '027-00000002', otherContacts: '',
      contacted: '已建联', pcCount: 200, rdCount: 80, accessMode: '私有化部署',
      monthlySpend: 15, models: 'GPT/GLM', tools: 'Copilot', registered: '是',
      region: '武汉', district: '洪山', lat: 30.4812, lng: 114.4238,
      dynamics: '完成A轮融资；经营范围变更新增车载软件开发',
      source: '探迹', note: '示例数据', sample: true
    },
    {
      name: '示例·光域游戏', keyAccount: '否', industry: '游戏制作',
      website: '', address: '东湖高新区光谷软件园x期（示例）',
      contact: '赵总', phone: '', otherContacts: '',
      contacted: '未建联', pcCount: 60, rdCount: 25, accessMode: '未定',
      monthlySpend: 0, models: '', tools: 'Unity AI', registered: '否',
      region: '武汉', district: '洪山', lat: 30.4746, lng: 114.4186,
      dynamics: '', source: '探迹', note: '示例数据', sample: true
    },
    {
      name: '示例·云维科技', keyAccount: '否', industry: '智能运维',
      website: 'https://www.yunwei.tech', address: '东湖高新区金融港x栋（示例）',
      contact: '张总', phone: '027-00000004', otherContacts: '',
      contacted: '已建联', pcCount: 80, rdCount: 30, accessMode: 'API',
      monthlySpend: 5, models: 'DeepSeek', tools: 'Dify', registered: '是',
      region: '武汉', district: '江夏', lat: 30.4631, lng: 114.4332,
      dynamics: '新增软件著作权2项；招聘SRE工程师',
      source: '自拓', note: '示例数据', sample: true
    },
    {
      name: '示例·江城智能客服', keyAccount: '否', industry: '智能客服',
      website: 'https://www.jc-kefu.com', address: '江汉区x路x号（示例）',
      contact: '陈总', phone: '027-00000006', otherContacts: '',
      contacted: '已建联', pcCount: 150, rdCount: 20, accessMode: '云平台',
      monthlySpend: 3, models: '通义', tools: 'Coze', registered: '否',
      region: '武汉', district: '江汉', lat: 30.5985, lng: 114.2715,
      dynamics: '近30天集中招聘客服运营与NLP工程师',
      source: '探迹', note: '示例数据', sample: true
    },
    {
      name: '示例·车谷智行', keyAccount: '是', industry: '自动驾驶',
      website: 'https://www.chequ-zx.cn', address: '经开区x园x栋（示例）',
      contact: '刘总', phone: '027-00000007', otherContacts: '算法负责人 周博 13900000002',
      contacted: '已建联', pcCount: 90, rdCount: 60, accessMode: 'API',
      monthlySpend: 12, models: 'GPT/通义', tools: 'Cursor', registered: '是',
      region: '武汉', district: '汉南', lat: 30.5065, lng: 114.1690,
      dynamics: '获自动驾驶新测试牌照；招标仿真平台扩容',
      source: '探迹', note: '示例数据', sample: true
    },
    {
      name: '示例·三峡智慧医疗', keyAccount: '否', industry: '医疗健康',
      website: '', address: '宜昌市西陵区x路x号（示例）',
      contact: '周总', phone: '0717-0000001', otherContacts: '',
      contacted: '未建联', pcCount: 40, rdCount: 8, accessMode: '未定',
      monthlySpend: 0, models: '', tools: '', registered: '否',
      region: '宜昌', district: '西陵', lat: 30.6920, lng: 111.2860,
      dynamics: '智慧互联网医院项目立项', source: '探迹', note: '示例数据', sample: true
    },
    {
      name: '示例·襄阳智造', keyAccount: '否', industry: '具身智能',
      website: '', address: '襄阳市高新区x园（示例）',
      contact: '吴总', phone: '', otherContacts: '',
      contacted: '未建联', pcCount: 30, rdCount: 12, accessMode: 'SDK',
      monthlySpend: 1, models: 'GLM', tools: '', registered: '否',
      region: '襄阳', district: '襄城', lat: 32.0090, lng: 112.1220,
      dynamics: '', source: '探迹', note: '示例数据', sample: true
    }
  ]
};
