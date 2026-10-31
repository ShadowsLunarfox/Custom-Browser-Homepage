# Legal documents

**English is the primary publication language.** The complete English drafts are [PRIVACY.md](../../PRIVACY.md) and [TERMS.md](../../TERMS.md) in the repository root. Complete translations are listed below. All legal documents remain Markdown; there is no HTML legal-document version.

| Language | Privacy policy | Terms of service |
| --- | --- | --- |
| English — primary | [Privacy Policy](../../PRIVACY.md) | [Terms of Service](../../TERMS.md) |
| 简体中文 | [隐私政策](PRIVACY.zh-CN.md) | [服务条款](TERMS.zh-CN.md) |
| 繁體粵語 | [私隱政策](PRIVACY.yue.md) | [服務條款](TERMS.yue.md) |
| 日本語 | [プライバシーポリシー](PRIVACY.ja.md) | [利用規約](TERMS.ja.md) |
| 한국어 | [개인정보 처리방침](PRIVACY.ko.md) | [서비스 약관](TERMS.ko.md) |
| ไทย | [นโยบายความเป็นส่วนตัว](PRIVACY.th.md) | [ข้อกำหนดการใช้บริการ](TERMS.th.md) |
| Bahasa Melayu | [Dasar Privasi](PRIVACY.ms.md) | [Terma Perkhidmatan](TERMS.ms.md) |

## Draft scope

These general drafts describe the current implementation. They select no national law, mandatory arbitration or exclusive court. The publisher is identified using the project's existing Lunarfox / ShadowsLunarfox name; no company, address, email or effective date has been invented. Mandatory local rights are preserved, and the repository's GPL license controls copying, modification and redistribution of source code.

English as the primary publication language does not override the drafts' protection of mandatory rights or create a new jurisdiction clause. Translations aim to express the same content. The extension's six existing interface languages link to their respective documents, with additional Traditional Cantonese documents available through the language navigation. These links do not add a mandatory acceptance flow or replace the Windows widget's separate data disclosure and optional permission consent.

## Before public release

1. Confirm the publisher identity and contact details required in your target markets. Add a real private contact channel when necessary; users should not post sensitive information in public Issues.
2. Review translations against actual release behavior, announce an effective date and retain a change record. A general draft does not replace legal review for a particular market.
3. Publish the English primary documents and translations at readable public URLs, for example the project's GitHub Markdown pages. The store policy URL should point to the complete English policy, with translations available through navigation. Local or unpushed files are not publicly published policies.
4. Set `privacyPolicyUrl` in `release/store-config.json`; `termsOfServiceUrl` can record a separate published terms URL. The source documents remain `.md` and do not require generated HTML files.
5. Confirm source-code and third-party asset licenses. The Terms must not withdraw GPL rights or claim that all bundled assets and user content are GPL-licensed.

## Sources and maintenance

- Behavior inventory: this project's storage, search, context-menu saving, media widget and native installer/uninstaller code.
- [Chrome user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): local processing also requires disclosure.
- [Chrome Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use): information use and transfer must stay within disclosed purposes.
- [Existing source-code license](../../LICENSE): the GNU GPL v3 text remains unchanged.

简体中文说明：英文是主要发布语言，根目录两份文件为完整英文草稿；简体中文及其他译本保存在本目录。正式发布前仍需核对发布者资料、联系渠道、翻译、生效日期和目标市场要求。
