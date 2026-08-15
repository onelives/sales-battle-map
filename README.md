# 销售地区作战图（湖北全域）

湖北全省 B 端销售作战工作台：全域地图布点 + 足迹点亮 + 探迹线索挖掘 + 企业动态溯源 + 拜访路线规划 + 统计看板。
覆盖 17 个地市州 × 51 条客户赛道，支持"区域×赛道"双维度联合获客。

## 系统架构

```
前端 index.html（GitHub Pages 静态站，不含任何密钥）
   │  ① GET {relayUrl}/api/tunjie?region=武汉&track=智能客服（双维挖掘）
   │  ② GET {relayUrl}/api/leads（启动加载线索）
   ▼
后端中转服务 server/（环境变量持有 探迹密钥 + Neon 连接串）
   │  ③ 调探迹开放平台拉线索；④ 天眼查/爱企查补全企业动态
   │  ⑤ 单条 INSERT 多 VALUES 批量写入（ON CONFLICT 幂等）
   ▼
Neon Serverless PostgreSQL（leads 表）
```

安全规则：探迹密钥与 Neon `DATABASE_URL` **仅**存在于中转服务环境变量；
前端 `data.js` 的 config 只允许配置 `relayUrl` 一个地址。

## 运行模式

| 模式 | 配置 | 行为 |
| --- | --- | --- |
| 本地模式（默认） | mode:'local'，relayUrl 留空 | 数据读写 data.js；"探迹线索挖掘"按 区域×赛道 生成模拟线索（标注"探迹(模拟)"），业务逻辑与真实一致 |
| 中转模式 | mode:'relay' + relayUrl | 启动时从 `GET {relayUrl}/api/leads`（Neon）加载客户；挖掘走 `GET /api/tunjie`，中转批量写入 Neon 后返回，前端提示写入条数 |

## 文件结构

```
index.html   页面主体（地图 + 足迹作战台 + 探迹挖掘 + 看板）
data.js      配置 + 全部客户数据（本地模式唯一维护文件）
vendor/      本地化前端库（Leaflet / ECharts / leaflet-heat，无 CDN 依赖）
server/      后端中转服务（探迹拉线索 + Neon 批量写入；含 schema.sql 与 .env.example）
```

## 核心功能

- 湖北全域地图：17 地市州客户布点；颜色=跟进状态，大小=优先级，发光=足迹点亮，外圈=深耕
- 足迹作战台：客户分布热力图、足迹轨迹串联（visits 按日期虚线连线）、一键生成拜访路线（就近串联+编号+预计里程）
- 双维联合获客：选定"区域+赛道"后点"⛏ 探迹线索挖掘"，模拟/真实模式自动切换
- 企业动态溯源：dynamics 字段（天眼查/爱企查动态），卡片与弹窗展示，搜索框可搜动态关键词
- 看板：顶部 7 项战况统计；底部状态/赛道/区域三图；四维筛选+关键词搜索

## 本地模式添加客户

1. 编辑 `data.js` 的 customers 数组（或网页"＋ 新增客户"生成代码）。
2. 经纬度用高德坐标拾取 <https://lbs.amap.com/tools/picker>（拾取为"经度,纬度"，lat=纬度）。
3. `git add data.js && git commit && git push`，Pages 自动更新。

## Neon 建表与中转服务启动

> 已就绪：Neon 项目 `sales-battle-map`（ID `flat-lab-91250958`）已创建，
> leads 表与索引已建好；`server/.env` 已预填本地连接串（勿提交 git）。
> 如需重建：Neon Console → SQL Editor 执行 `server/schema.sql`。

1. Neon Console 新建项目 → SQL Editor 执行 `server/schema.sql`
   （leads 表，`UNIQUE(name, region)` 保证重复挖掘幂等）。
2. 部署中转服务（任意 Node 主机 / 云函数均可）：

```bash
cd server
npm install
cp .env.example .env   # 填 DATABASE_URL（Neon 连接串）与探迹密钥
npm start              # 默认 http://localhost:8787
```

3. 前端 `data.js` 设置 `config.mode='relay'`、`config.relayUrl='https://你的中转域名'`，推送即生效。

批量写入实现：`server.js` 的 `bulkInsertLeads()` 将当次探迹返回的全部线索拼成
**单条 INSERT … 多组 VALUES** 一次往返写入 Neon（Serverless 下最省连接），
`ON CONFLICT (name, region) DO NOTHING` 去重，返回实际写入条数给前端展示。

排障：本机若开 Clash Verge TUN 模式，全部流量走虚拟 IP 198.18.x，可能导致
中转服务连 Neon（海外端点）TLS 握手失败（ECONNRESET）。解法：换代理节点，
或在 Clash 规则里对 Neon 域名（`*.neon.tech`）加 DIRECT。

## 后端中转服务接口约定

`GET {relayUrl}/api/tunjie?region={地市}&track={赛道}` 返回：

```json
{
  "region": "武汉", "track": "智能客服",
  "leads": [
    { "name": "武汉xx科技有限公司", "lat": 30.59, "lng": 114.30,
      "region": "武汉", "industry": "智能客服", "priority": "高",
      "dynamics": "近30天招聘NLP工程师", "address": "…", "phone": "…", "contact": "…" }
  ],
  "written": 12,
  "storage": "neon"
}
```

另有 `GET /api/leads`（Neon 全量线索，前端启动加载）与 `GET /api/health`
（检查 neon/tunjie 配置状态）。中转内部：持探迹密钥调开放平台按 地区+行业
检索企业，经天眼查/爱企查补全 dynamics 后，批量写入 Neon 再返回；前端不接触任何密钥。

## 字段说明

| 字段 | 含义 | 取值 |
| --- | --- | --- |
| name | 公司名称 | 必填 |
| lat / lng | 纬度 / 经度 | 必填 |
| region | 湖北地市 | 武汉/黄石/十堰/宜昌/襄阳/鄂州/荆门/孝感/荆州/黄冈/咸宁/随州/恩施州/仙桃/潜江/天门/神农架 |
| industry | 客户赛道 | 51 方向，见 data.js |
| status | 跟进状态 | 未联系 / 已联系 / 意向中 / 已签约 |
| priority | 优先级 | 高 / 中 / 低 |
| footprint | 足迹点亮 | 未点亮 / 已点亮 / 深耕 |
| visits | 足迹时序 | `[{date, note}]` |
| dynamics | 企业动态溯源 | 文本 |
| source | 线索来源 | 探迹 / 探迹(模拟) / 自拓 |
