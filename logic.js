/**
 * logic.js
 * 骨粗鬆症治療薬選択補助アプリのロジックエンジン
 * Based on provided YAML rules and ASBMR/BHOF 2024
 */

const CONSTANTS = {
    RISK: {
        VERY_HIGH: 'Very High',
        HIGH: 'High',
        LOW: 'Low'
    },
    CKD: {
        G1_2: '1_2',
        G3: '3',
        G4_5: '4_5',
        UNKNOWN: 'unknown'
    },
    T_SCORE: {
        LT_33: 'lt_-3.3',
        BETWEEN_33_25: '-3.3_to_-2.5',
        BETWEEN_25_10: '-2.5_to_-1.0',
        GE_10: 'ge_-1.0',
        UNKNOWN: 'unknown'
    }
};

/**
 * メイン判定関数
 * @param {Object} inputs - フォームからの入力値
 * @returns {Object} { risk, treatment, warnings, goal }
 */
function evaluateTreatment(inputs) {
    // Pre-calculate derived risk boolean (Detailed High Risk Factors)
    inputs.hasHighRiskFactor = inputs.risk_steroid ||
        inputs.risk_parent_hip_fx ||
        inputs.risk_frax ||
        inputs.risk_diabetes ||
        inputs.risk_ckd ||
        inputs.risk_copd ||
        inputs.ckd_stage === '3' ||
        inputs.ckd_stage === '4_5';

    // Special Case: BMD Unknown + No Fracture -> Hide Results, Show Warning
    const hasFracture = inputs.fx_any || inputs.fx_morphological;
    if (inputs.t_group === 'unknown' && !hasFracture) {
        return {
            risk: 'Unknown', // User requested 'Unknown' state
            treatment: null,
            goal: null,
            warnings: checkWarnings(inputs, null)
        };
    }

    const risk = calculateRisk(inputs);
    const treatment = determineTreatment(risk, inputs);
    const warnings = checkWarnings(inputs, treatment);
    const goal = determineGoal(risk, inputs);

    return {
        risk,
        treatment,
        warnings,
        goal
    };
}

/**
 * リスク分類ロジック
 */
/**
 * リスク分類ロジック
 */
function calculateRisk(inputs) {
    const isOsteoporosis = inputs.t_group === CONSTANTS.T_SCORE.LT_33 || inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_33_25;
    const isOsteopenia = inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_25_10;

    // --- Very High Risk Conditions ---

    // 1. T-score < -3.3 (Severe Osteoporosis)
    if (inputs.t_group === CONSTANTS.T_SCORE.LT_33) return CONSTANTS.RISK.VERY_HIGH;

    // 2. 高度椎体骨折 (Severe Vertebral Fracture: Clinical OR Morphological)
    if (inputs.fx_vertebral_severe || inputs.fx_morphological_severe) return CONSTANTS.RISK.VERY_HIGH;

    // 3. 脆弱性骨折(any) ＋ 骨粗鬆症(T < -2.5) -> Very High
    // Note: fx_morphological counts as a fracture for this logic?
    // User request: "Select severe morphological -> Anabolic". This is covered by Rule 2 above.
    // Let's assume Morphological fracture also counts towards High Risk generally.
    const hasFractureHistory = inputs.fx_any || inputs.fx_morphological;

    if (hasFractureHistory && isOsteoporosis) return CONSTANTS.RISK.VERY_HIGH;

    // 4. (主要骨折 OR 直近24m骨折) + 骨量減少 -> Very High (Special Case)
    // Note: fx_severe is now "Clinical Vertebral/Proximal Femur".
    // Is fx_morphological included here? Usually clinical is more severe. Keep as is for now unless needed.
    if ((inputs.fx_severe || inputs.fx_recent_24m) && isOsteopenia) return CONSTANTS.RISK.VERY_HIGH;

    // 5. [NEW] 高リスク因子あり ＋ (骨折歴あり OR 骨粗鬆症(T < -2.5)) -> Very High
    if (inputs.hasHighRiskFactor && (hasFractureHistory || isOsteoporosis)) return CONSTANTS.RISK.VERY_HIGH;

    // 6. GIO Logic -> Very High
    if (getGIOTreatment && getGIOTreatment(inputs)) return CONSTANTS.RISK.VERY_HIGH;

    // 7. Early Menopause Special Case (40-45y)
    const isEarlyMenopauseRule = inputs.age >= 40 && inputs.age < 45 && (inputs.frax_early_menopause || inputs.menopause === 'yes');
    if (isEarlyMenopauseRule) {
        if (isOsteoporosis) return CONSTANTS.RISK.VERY_HIGH;
        return CONSTANTS.RISK.HIGH;
    }


    // --- High Risk Conditions ---

    // 1. Antihormonal Therapy Special Cases (Osteopenia + Specific/No Risks) -> High
    if (getAntihormonalType && getAntihormonalType(inputs)) return CONSTANTS.RISK.HIGH;

    // 2. [NEW] 高リスク因子あり (Calculated above to be Very High if fracture/Op matches, otherwise High)
    if (inputs.hasHighRiskFactor) return CONSTANTS.RISK.HIGH;

    // 3. 脆弱性骨折あり (Fracture alone = High)
    if (hasFractureHistory) return CONSTANTS.RISK.HIGH;

    // 4. -3.3 <= T-score < -2.5 (Osteoporosis alone = High)
    if (inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_33_25) return CONSTANTS.RISK.HIGH;

    // (Note: Osteopenia + High Risk Factor is covered by "if (inputs.hasHighRiskFactor) return HIGH" above)


    // --- Low Risk ---
    return CONSTANTS.RISK.LOW;
}

/**
 * 治療目標決定ロジック
 */
function determineGoal(risk, inputs) {
    const isOsteopenia = inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_25_10;
    const isOsteoporosis = inputs.t_group === CONSTANTS.T_SCORE.LT_33 || inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_33_25;
    const isNormal = inputs.t_group === CONSTANTS.T_SCORE.GE_10;

    // Early Menopause Special Goal
    const isEarlyMenopauseRule = inputs.age >= 40 && inputs.age < 45 && (inputs.frax_early_menopause || inputs.menopause === 'yes');
    if (isEarlyMenopauseRule) return "婦人科と連携して対応";

    // 骨折歴ありの場合 (Morphological Fracture included)
    if (inputs.fx_any || inputs.fx_morphological) {
        if (isOsteopenia) {
            return "①大腿骨近位部骨密度 +3%　②T score≧‐1.0";
        }
        // Default Goal for Fracture cases (if not Osteopenia)
        return "T-score ≧ -1.0 達成 および 二次性骨折の予防";
    }

    // GIO Goal (Treat to Target) - User Request: "Treat to Target 骨折予防・骨密度の正常化と維持(T≧-1.0)"
    // Check if GIO takes precedence (i.e., GIO regimen exists)
    if (getGIOTreatment && getGIOTreatment(inputs)) {
        return "骨折予防・骨密度の正常化と維持(T≧-1.0)";
    }

    // Antihormonal Therapy Goals
    const ahType = getAntihormonalType ? getAntihormonalType(inputs) : null;
    if (ahType === 'CASE_2') return "骨折予防・T score ≧ -1.5";
    if (ahType === 'CASE_1') return "骨折予防・T score ≧ -2.0";

    // 骨折なしの場合
    else {
        // 骨密度が骨粗鬆症以下なら T score>-2.5を目指して治療　目標は3年以内に達成を目指す
        if (isOsteoporosis) { // T < -2.5
            return "T score > -2.5を目指して治療します。目標は3年以内に達成を目指します。";
        }

        // 骨量減少、risk classificationがhigh, very highの場合； T score>-2.5の維持、さらなる増加を目指す
        if (isOsteopenia && (risk === CONSTANTS.RISK.HIGH || risk === CONSTANTS.RISK.VERY_HIGH)) {
            return "T score > -2.5の維持、さらなる増加を目指します。";
        }

        // 骨密度正常；骨密度の維持と骨折しない体づくり
        if (isNormal) {
            return "骨密度の維持と骨折しない体づくりを目指します。";
        }

        // Fallback (e.g. Osteopenia but Low Risk - though app logic usually puts Osteopenia as Low Risk unless factors exist)
        if (isOsteopenia && risk === CONSTANTS.RISK.LOW) {
            return "生活習慣指導による骨量維持";
        }
    }

    // Generic fallback
    return "骨量維持・骨折回避";
}

/**
 * 治療薬選択ロジック
 */
function determineTreatment(risk, inputs) {
    // Pregnancy/Lactation Check
    if (inputs.menopause === 'pregnancy') {
        return {
            first_line: "この時期は食事からカルシウムを摂取することがとても大事です。薬物治療の必要性については産婦人科の担当医と相談してください。",
            second_line: "",
            third_line: "",
            note: "テリパラチド、アバロパラチド、デノスマブ、SERM、エルデカルシトールは妊娠中は使用できません"
        };
    }

    // Use robust string check for T-score to catch Osteoporosis ranges
    // Matches 'lt_-3.3' and '-3.3_to_-2.5'
    const isOsteoporosis = inputs.t_group && (inputs.t_group === CONSTANTS.T_SCORE.LT_33 || inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_33_25);
    const isOsteopenia = inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_25_10;
    const isNormal = inputs.t_group === CONSTANTS.T_SCORE.GE_10;

    // --- Special Rule: Early Menopause (40-45y) ---
    const isEarlyMenopauseRule = inputs.age >= 40 && inputs.age < 45 && (inputs.frax_early_menopause || inputs.menopause === 'yes');
    if (isEarlyMenopauseRule) {
        if (isOsteoporosis) {
            return {
                first_line: "ホルモン補充療法適応の可能性が高いです。婦人科と相談してください。",
                second_line: "HRT後も骨密度上昇が乏しく、骨折の危険性が高ければ一般的な骨粗鬆症治療薬を併用する可能性もあります。専門医を受診させてください。",
                third_line: "---",
                note: "婦人科と連携して対応"
            };
        } else {
            // Normal / Osteopenia / Unknown
            return {
                first_line: "ホルモン補充療法適応の可能性があります。婦人科と相談してください。",
                second_line: "---",
                third_line: "---",
                note: "婦人科と連携して対応"
            };
        }
    }

    // --- Special Rule: Post-Menopause Early Phase (45-49y) SEVERE ---
    // Severe Osteoporosis (T < -3.3) + No Fracture
    const isSevereOP_T = inputs.t_group === CONSTANTS.T_SCORE.LT_33;
    const isPostMenoEarlySevereRule = inputs.age >= 45 && inputs.age < 55 && inputs.menopause === 'yes' && isSevereOP_T &&
        !(inputs.fx_any || inputs.fx_morphological || inputs.fx_recent_24m || inputs.fx_vertebral_severe || inputs.fx_severe);

    if (isPostMenoEarlySevereRule) {
        return {
            first_line: "ロモソズマブ / テリパラチド / アバロパラチド",
            second_line: "ホルモン補充療法の適応がないか婦人科紹介",
            third_line: "デノスマブ",
            note: "骨折の危険性の高い骨粗鬆症で、骨形成促進薬の治療を考慮します"
        };
    }

    // --- Special Rule: Post-Menopause Early Phase (45-49y) ---
    // Osteoporosis + No Fracture
    const isPostMenoEarlyRule = inputs.age >= 45 && inputs.age < 50 && inputs.menopause === 'yes' && isOsteoporosis &&
        !(inputs.fx_any || inputs.fx_morphological || inputs.fx_recent_24m || inputs.fx_vertebral_severe || inputs.fx_severe);

    if (isPostMenoEarlyRule) {
        return {
            first_line: "ビスホスホネート / デノスマブ",
            second_line: "ホルモン補充療法の適応がないか婦人科紹介",
            third_line: "---",
            note: "閉経後早期のため、婦人科との連携も考慮します。"
        };
    }

    // --- Special Rule: Recent Minor Fracture + Normal BMD ---
    // Condition: Normal BMD + Recent Fx (24m) + NO Severe Vertebral Fx
    if (isNormal && inputs.fx_recent_24m && !inputs.fx_severe) {
        return {
            first_line: `
                <ul style="margin: 0; padding-left: 1.2em; text-align: left;">
                    <li>続発性骨粗鬆症を起こす疾患の検索（かかりつけ医、専門医と相談）</li>
                    <li>FRAXで骨折リスクを評価、是正可能な骨折リスクの修正（飲酒・喫煙・体重）</li>
                    <li>転倒予防（併存疾患・転倒誘発薬のチェック）</li>
                    <li>徹底した運動療法＋食事療法＋最低年1回の骨密度フォロー</li>
                </ul>
            `,
            second_line: "ビスフォスフォネート もしくは デノスマブ もしくは エルデカルシトール単剤",
            third_line: "---",
            note: "",
            isRareCase: true
        };
    }

    // --- Special Rule: Menopausal Transition (Osteopenia, 45-55y, Female, No Fracture, Low Risk) ---
    // User Request: Limit HRT recommendation to "Low Risk" only.
    const isMenopausalAge = inputs.sex === 'female' && inputs.age >= 45 && inputs.age <= 55;
    if (isOsteopenia && isMenopausalAge && !(inputs.fx_any || inputs.fx_morphological) && risk === CONSTANTS.RISK.LOW) {
        return {
            first_line: "更年期症状があれば女性ホルモン補充療法（禁忌；血栓症の既往、乳がん、子宮体がん）<br>婦人科受診を検討してください。",
            second_line: "生活習慣の改善、運動・食事療法の徹底、最低年1回の骨密度フォロー",
            third_line: "",
            note: "保険適応として認められやすい更年期症状, ホットフラッシュ, のぼせ, 発汗, 不眠, 抑うつ, 易疲労感, イライラ, 腟乾燥, 性交痛, 頻尿・排尿違和感, 月経不順, 無月経",
            isMenopausalTransition: true
        };
    }

    // --- Fracture & Severe Logic Definitions (Lifted for GIO Priority Check) ---
    const hasFracture = inputs.fx_any || inputs.fx_severe || inputs.fx_morphological || inputs.fx_recent_24m || inputs.fx_vertebral_severe;

    // Condition 1: Main Anabolic Rule (Osteoporosis + Fx OR Severe Osteoporosis T < -3.3)
    const isMainAnabolicRule =
        (hasFracture && isOsteoporosis) ||
        (inputs.t_group === CONSTANTS.T_SCORE.LT_33);

    // Condition 2: Special Rule for Severe Vertebral Fracture (ANY BMD)
    const isSevereVertebralFxRule =
        (inputs.fx_vertebral_severe || inputs.fx_morphological_severe);


    // --- GIO Logic Integration ---
    // Check GIO specific algorithms. 
    // Uses separate helper. If returns result, use it UNLESS Main Anabolic Rules override.
    // User Requirement: "If Currently Taking && Fx && OP -> Main Alg". 
    // "Main Alg" is Anabolic. GIO Prev 2 is also Anabolic. 
    // We prioritize Main Alg/Severe Fx Rule (Standard) if they apply, otherwise check GIO.
    const isStandardSevereRule = isMainAnabolicRule || isSevereVertebralFxRule;

    if (!isStandardSevereRule) {
        const gioResult = getGIOTreatment(inputs, risk);
        if (gioResult) {
            return gioResult;
        }
    }


    // --- Antihormonal Therapy Logic ---
    if (!hasFracture && inputs.risk_antihormonal) {
        // 1. Osteoporosis (T < -2.5 but NOT Severe T < -3.3)
        // Severe (T < -3.3) falls through to Very High Logic for Romosozumab
        if (isOsteoporosis && inputs.t_group !== CONSTANTS.T_SCORE.LT_33) {
            return {
                first_line: "デノスマブ / ゾレドロン酸",
                second_line: "アレンドロン酸 / リセドロン酸",
                third_line: "---",
                note: "抗性ホルモン療法中（乳癌・前立腺癌）: デノスマブまたはゾレドロン酸が推奨されます。"
            };
        }

        // 2. Osteopenia Special Cases
        // (Osteopenia, specific risk combos, NO Fracture)
        const ahType = getAntihormonalType ? getAntihormonalType(inputs) : null;
        if (ahType) {
            const goalT = ahType === 'CASE_2' ? '-1.5' : '-2.0';
            return {
                first_line: "デノスマブ or ゾレドロン酸",
                second_line: "アレンドロン酸 or リセドロン酸",
                third_line: "---",
                note: `抗性ホルモン療法中（乳癌・前立腺癌）: T score < ${goalT} のため治療推奨です。SERMとアロマターゼ阻害薬の併用は原則推奨しません。`
            };
        }
    }

    // --- Very High Risk Logic (Standard) ---
    if (risk === CONSTANTS.RISK.VERY_HIGH) {

        // 1. Anabolic Indication (Severe Vertebral)
        // (Variables hasFracture, isMainAnabolicRule, isSevereVertebralFxRule defined above)

        if (inputs.injectable) {

            // 1. Main Rule (Osteoporosis + Fx / Severe OP)
            if (isMainAnabolicRule) {
                // Case A: CV Event Recent (Avoid Romosozumab)
                if (inputs.cv_event_recent_12m) {
                    if (inputs.contraindication_pth) {
                        return {
                            first_line: "デノスマブ",
                            second_line: "ビスホスホネート",
                            third_line: "---",
                            note: "心血管リスクによりロモソズマブ回避、かつPTH製剤禁忌のため、デノスマブを推奨します。"
                        };
                    } else {
                        return {
                            first_line: "テリパラチド or アバロパラチド",
                            second_line: "デノスマブ",
                            third_line: "ビスホスホネート",
                            note: "心血管イベントリスクのためロモソズマブを回避します。骨折リスクが高いため骨形成促進薬を推奨します。"
                        };
                    }
                }
                // Case B: No CV Risk (Romosozumab OK)
                // Case B: No CV Risk (Romosozumab OK)
                else {
                    if (inputs.risk_antihormonal) {
                        const ahNote = hasFracture ?
                            "骨折歴を有する骨粗鬆症は「重症骨粗鬆症」のため、骨形成促進薬を第一選択として推奨します。PTH製剤は抗性ホルモン療法中は原則使用推奨しません。" :
                            "骨折の危険性の高い骨粗鬆症のため、骨形成促進薬を第一選択として推奨します。PTH製剤は抗性ホルモン療法中は原則使用推奨しません。";

                        return {
                            first_line: "ロモソズマブ",
                            second_line: "デノスマブ",
                            third_line: "ビスホスホネート",
                            note: ahNote
                        };
                    } else if (inputs.contraindication_pth) {
                        return {
                            first_line: "ロモソズマブ",
                            second_line: "デノスマブ",
                            third_line: "ビスホスホネート",
                            note: "PTH製剤禁忌（高Ca血症・骨腫瘍等）のため、骨形成促進薬としてロモソズマブを推奨します。"
                        };
                    } else {
                        const stdNote = hasFracture ?
                            "骨折歴を有する骨粗鬆症は「重症骨粗鬆症」のため、骨形成促進薬を第一選択として推奨します。" :
                            "骨折の危険性の高い骨粗鬆症のため、骨形成促進薬を第一選択として推奨します。";

                        return {
                            first_line: "ロモソズマブ / テリパラチド / アバロパラチド",
                            second_line: "デノスマブ",
                            third_line: "ビスホスホネート",
                            note: stdNote
                        };
                    }
                }
            }

            // 2. Special Rule (Severe Vertebral Fx)
            else if (isSevereVertebralFxRule) {
                // Case A: CV Event Recent (Avoid Romosozumab)
                if (inputs.cv_event_recent_12m) {
                    if (inputs.contraindication_pth) {
                        return {
                            first_line: "デノスマブ",
                            second_line: "ビスホスホネート",
                            third_line: "---",
                            note: "重症椎体骨折がありますが、心血管リスク(ロモ回避)およびPTH禁忌のため、デノスマブを推奨します。"
                        };
                    }
                    return {
                        first_line: "テリパラチド or アバロパラチド",
                        second_line: "デノスマブ",
                        third_line: "ビスホスホネート",
                        note: "重症椎体骨折あり。心血管イベントリスクのためロモソズマブを回避します。"
                    };
                }
                // Case B: No CV Risk
                else {
                    if (inputs.contraindication_pth) {
                        return {
                            first_line: "ロモソズマブ",
                            second_line: "デノスマブ",
                            third_line: "ビスホスホネート",
                            note: "重症椎体骨折あり。PTH製剤禁忌のため、ロモソズマブを第一選択とします。"
                        };
                    }
                    return {
                        first_line: "テリパラチド / アバロパラチド",
                        second_line: "ロモソズマブ",
                        third_line: "デノスマブ or ビスホスホネート",
                        note: "重症椎体骨折（多発・高度圧壊）は「骨折の危険性が高い骨粗鬆症」のため骨形成促進薬推奨。逐次療法は3rd line薬剤を推奨します。"
                    };
                }
            }

            // 3. Fallback
            else {
                return {
                    first_line: "デノスマブ",
                    second_line: "ビスホスホネート",
                    third_line: "---",
                    note: "骨形成促進薬の適応基準（骨粗鬆症＋骨折、または重症骨粗鬆症）を満たさないため、デノスマブを推奨します。"
                };
            }
        } else {
            return {
                first_line: "ビスホスホネート (経口/静注)",
                second_line: "---",
                third_line: "---",
                note: "注射製剤困難なためBPを推奨します。効果不十分または新規骨折時に注射治療を再検討してください"
            };
        }
    }

    // --- High Risk Logic ---
    if (risk === CONSTANTS.RISK.HIGH) {

        // Rule: 脆弱性骨折以外の高リスク因子 ＋ 骨量減少 -> Denosumab 1st, BP 2nd, SERM 3rd
        if (inputs.hasHighRiskFactor && isOsteopenia && !inputs.fx_any) {
            if (inputs.injectable) {
                return {
                    first_line: "デノスマブ",
                    second_line: "ビスホスホネート",
                    third_line: "SERM (腰椎のみの骨粗鬆症)",
                    note: "骨量減少＋高リスク因子のためデノスマブを推奨します。大腿骨の骨密度が保たれていればSERMも考慮できます。"
                };
            }
        }

        // SERM Check

        // 1. 骨粗鬆症のみ (骨折なし)
        if (isOsteoporosis) {
            if (inputs.risk_antihormonal) {
                return {
                    first_line: "デノスマブ / ゾレドロン酸",
                    second_line: "アレンドロン酸 / リセドロン酸",
                    third_line: "---",
                    note: "抗性ホルモン療法中（乳癌・前立腺癌）: デノスマブまたはゾレドロン酸が推奨されます。"
                };
            }

            return {
                first_line: "ビスホスホネート (経口/静注)",
                second_line: "デノスマブ",
                third_line: "SERM (腰椎のみの骨粗鬆症)",
                note: inputs.age >= 76 ? "骨折リスクが高いため、まずはBP製剤またはデノスマブを推奨します。(腰椎のみの骨粗鬆症ならSERMも選択枝となりえます)" : "骨折リスクが高いため、まずはBP製剤またはデノスマブを推奨します。"
            };
        }

        // 2. 骨量減少 ＋ (高リスク因子 OR 骨折歴あり)
        // User Request: Osteopenia + Fracture -> Deno 1st, BP 2nd, Long-term 3rd
        if (isOsteopenia && (inputs.hasHighRiskFactor || inputs.fx_any || inputs.fx_morphological)) {

            const thirdLine = (inputs.fx_any || inputs.fx_morphological) ? "長期管理（休薬せず継続）" : "SERM (腰椎のみの骨粗鬆症)";
            let noteText = (inputs.fx_any || inputs.fx_morphological) ?
                "骨量減少ですが、脆弱性骨折歴を有するためデノスマブを推奨します。" :
                "骨量減少に加え、リスク因子を有するためデノスマブを推奨します。";

            if (inputs.age >= 76 && thirdLine.includes("SERM")) {
                noteText += "(腰椎のみの骨粗鬆症ならSERMも選択枝となりえます)";
            }

            if (inputs.injectable) {
                return {
                    first_line: "デノスマブ",
                    second_line: "ビスホスホネート",
                    third_line: thirdLine,
                    note: noteText
                };
            } else {
                let secondLine = inputs.risk_antihormonal ? "---" : "SERM";
                if (inputs.age >= 76) secondLine = "---";

                return {
                    first_line: "ビスホスホネート",
                    second_line: secondLine,
                    third_line: "---",
                    note: "注射製剤が困難なため経口薬を推奨します。"
                };
            }
        }

        // 4. Normal BMD + High Risk + No Fracture
        if (!isOsteoporosis && !isOsteopenia && !inputs.fx_any) {
            return {
                first_line: "生活習慣指導・食事・運動療法",
                second_line: "---",
                third_line: "---",
                note: "現状は薬物治療の基準は満たしません。ハイリスク因子があるので、椎体骨折の積極的な検索を推奨します。骨密度検査も年1回を推奨します。"
            };
        }

        // 3. その他 High Risk (e.g. Osteoporosis only fallen through?)
        // If Osteoporosis was caught by Rule 1, what's left? 
        // Perhaps rare combos. Default to BP.
        let secondLine = inputs.risk_antihormonal ? "---" : "SERM";
        if (inputs.age >= 76) secondLine = "---";

        return {
            first_line: "ビスホスホネート",
            second_line: secondLine,
            third_line: "---",
            note: "標準的な治療を検討してください。"
        };
    }


    // --- Low Risk Logic ---
    return {
        first_line: "生活習慣指導・食事・運動療法",
        second_line: "---",
        third_line: "---"
    };
}

/**
 * 禁忌・警告チェック
 */
function checkWarnings(inputs, treatment) {
    let warnings = [];

    // CKD Logic
    if (inputs.ckd_stage === CONSTANTS.CKD.G4_5) {
        warnings.push("CKD G4-5: 経口BPは（アレンドロン酸/ミノドロン酸）のみ慎重投与可能です。急性腎障害に留意してください。");
        warnings.push("デノスマブ使用時は低カルシウム血症リスクが高いため、必ずCa/VitDを補正し慎重に導入してください。");
    } else if (inputs.ckd_stage === CONSTANTS.CKD.UNKNOWN) {
        warnings.push("腎機能が不明です。BP/デノスマブ開始前にeGFRを確認してください。");
    }

    // Hypocalcemia
    if (inputs.hypocalcemia_risk) {
        warnings.push("低カルシウム血症；ロモソズマブ、デノスマブ、ビスホスホネートはカルシウムとビタミンD投与でしっかりと補正してから使用してください。");
    }

    // Hypercalcemia Specific Warning
    if (inputs.hypercalcemia) {
        warnings.push("高カルシウム血症；活性型ビタミンD製剤・カルシウムサプリメントは中止のうえ、原疾患を検索してください。悪性腫瘍（肺がん、乳がん、前立腺がん、血液がん）、副甲状腺機能亢進症、サルコイドーシスなど");
    }

    // PTH Contraindications (Hypercalcemia, Bone Tumor, Primary HPT, Paget's)
    if (inputs.contraindication_pth) {
        warnings.push("PTH製剤（テリパラチド/アバロパラチド）：禁忌（高Ca血症・骨腫瘍等）のため使用できません。");

        const pthDrugs = ['テリパラチド', 'アバロパラチド'];
        const isRecommended = treatment && (
            (treatment.first_line && pthDrugs.some(drug => treatment.first_line.includes(drug))) ||
            (treatment.second_line && pthDrugs.some(drug => treatment.second_line.includes(drug)))
        );

        if (isRecommended) {
            warnings.push("CRITICAL: 現在の選択薬にテリパラチド/アバロパラチドが含まれていますが、回避すべき症例です。");
        }
    }

    // Antihormonal Therapy Warnings
    if (inputs.risk_antihormonal) {
        warnings.push("抗性ホルモン療法中：テリパラチド・アバロパラチドは原則使用しません。骨転移の評価を十分に行ってください。");
        warnings.push("抗性ホルモン療法中：アロマターゼ阻害薬とSERMの併用は推奨されません（乳癌治療効果低下の懸念）。");

        // Critical Checks for Drug Conflicts
        const pthDrugs = ['テリパラチド', 'アバロパラチド'];
        if (treatment && ((treatment.first_line && pthDrugs.some(d => treatment.first_line.includes(d))) || (treatment.second_line && pthDrugs.some(d => treatment.second_line.includes(d))))) {
            warnings.push("WARNING: 抗性ホルモン療法中のため、PTH製剤の使用は骨転移がないことを慎重に確認してください。");
        }
        if (treatment && ((treatment.first_line && treatment.first_line.includes('SERM')) || (treatment.second_line && treatment.second_line.includes('SERM')) || (treatment.third_line && treatment.third_line.includes('SERM')))) {
            warnings.push("WARNING: 抗性ホルモン療法中のため、SERMの併用は避けてください。");
        }
    }

    // Cardiovascular
    if (inputs.cv_event_recent_12m) {
        warnings.push("心血管イベント既往（直近12ヶ月）：ロモソズマブは原則回避してください。");
        if (treatment && treatment.first_line && treatment.first_line.includes('ロモソズマブ')) {
            warnings.push("CRITICAL: 現在の選択薬にロモソズマブが含まれていますが、回避すべき症例です。");
        }
    }

    return warnings;
}


/**
 * GIO治療アルゴリズム評価ヘルパー
 * @param {Object} inputs
 * @param {string} risk - Calculated Risk
 * @returns {Object|null} treatment object or null
 */
function getGIOTreatment(inputs, risk) {
    if (!inputs.steroid_current) return null;

    const dose = inputs.steroid_dose; // 'lt_5', '5_to_7.5', 'ge_7.5'
    const hasFracture = inputs.fx_any || inputs.fx_morphological;
    const isOsteoporosis = inputs.t_group && inputs.t_group.indexOf('-3.3') !== -1;
    const isOsteopenia = inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_25_10;
    const isNormal = inputs.t_group === CONSTANTS.T_SCORE.GE_10;
    const isUnknown = inputs.t_group === CONSTANTS.T_SCORE.UNKNOWN || inputs.t_group === 'unknown';
    const age = inputs.age;

    // Regimen Definitions
    const regimens = {
        TREATMENT: {
            first_line: "デノスマブ / テリパラチド・アバロパラチド (骨折リスクが高い場合)",
            second_line: "ビスホスホネート",
            third_line: "---",
            note: "骨折リスクが高い場合は骨形成促進薬を考慮してください。可能であればステロイド減量も検討してください。"
        },
        PREV_1: {
            apply: (hasRisk) => {
                if (hasRisk) {
                    return {
                        first_line: "テリパラチド (骨折の危険性の高い骨粗鬆症)",
                        second_line: "デノスマブ",
                        third_line: "ビスホスホネート",
                        note: "ビスフォスフォネートより椎体骨折予防効果が高いテリパラチドを推奨します。"
                    };
                } else {
                    return {
                        first_line: "ビスホスホネート or デノスマブ",
                        second_line: "SERM / エルデカルシトール",
                        third_line: "---",
                        note: "ステロイド性骨粗鬆症として治療介入を推奨します。"
                    };
                }
            }
        },
        PREV_2: {
            first_line: "テリパラチド (骨折の危険性の高い骨粗鬆症)",
            second_line: "デノスマブ",
            third_line: "ビスホスホネート",
            note: "既存骨折があり骨折リスクが高いため、骨形成促進薬を第一選択として推奨します。"
        }
    };

    // Calculate "Other High Risk Factor" for Prev Alg 1 Logic
    // Defined in prompt as "Other fracture high risk factor".
    // Does this include Dose? Probably the standard list (excluding steroid itself?).
    // Let's assume standard high risk list.
    const hasOtherHighRisk = inputs.risk_parent_hip_fx || inputs.risk_frax || inputs.risk_diabetes || inputs.risk_ckd || inputs.risk_copd || inputs.risk_hormone || inputs.ckd_stage === '3' || inputs.ckd_stage === '4_5';

    // *** Decision Tree ***

    // 1. Prednisolone < 5mg
    if (dose === 'lt_5') {
        if (hasFracture) return regimens.PREV_2;

        // No Fracture
        if (age >= 65 && (isNormal || isOsteopenia || isUnknown)) return regimens.PREV_1.apply(hasOtherHighRisk);
        if (age >= 50 && age < 65 && isOsteopenia) return regimens.PREV_1.apply(hasOtherHighRisk);
        // Prompt Check: "if Fx No && Osteoporosis then Prev Alg 1" (Implicit for <5mg?)
        // The prompt says: "if Fx No && Osteoporosis then GIO Prev Alg 1"
        if (isOsteoporosis) return regimens.PREV_1.apply(hasOtherHighRisk);
    }

    // 2. Prednisolone 5 - 7.5mg
    else if (dose === '5_to_7.5') {
        if (hasFracture) return regimens.PREV_2;

        // No Fracture
        if (age < 50 && isOsteopenia) return regimens.PREV_1.apply(hasOtherHighRisk);
        if (age >= 50 && (isNormal || isOsteopenia || isUnknown)) return regimens.PREV_1.apply(hasOtherHighRisk);
        if (age >= 50 && isOsteoporosis) return regimens.TREATMENT;
        // Note: For 50+ OP, use Treatment Alg. For <50 OP? Prompt doesn't explicit mention, maybe Treatment?
        // Let's assume if OP is present, Treatment is usually indicated if not Prevention.
        // Prompt says "if Fx No && 50+ && OP then GIO Treatment Alg".
        // What about <50 && OP? GIO Logic usually treats OP.
        if (isOsteoporosis) return regimens.TREATMENT;
    }

    // 3. Prednisolone >= 7.5mg
    else if (dose === 'ge_7.5') {
        if (hasFracture) return regimens.PREV_2;

        // No Fracture
        if (isNormal || isOsteopenia || isUnknown) return regimens.PREV_1.apply(hasOtherHighRisk);
        if (isOsteoporosis) return regimens.TREATMENT;
    }

    return null; // Logic didn't hit a GIO criteria (e.g. <5mg, <50y, Normal BMD)
}

/**
 * Antihormonal Therapy Helper
 * @returns 'CASE_1' | 'CASE_2' | null
 */
function getAntihormonalType(inputs) {
    if (!inputs.risk_antihormonal) return null;
    const isOsteopenia = inputs.t_group === CONSTANTS.T_SCORE.BETWEEN_25_10;
    const hasFracture = inputs.fx_any || inputs.fx_morphological || inputs.fx_recent_24m || inputs.fx_vertebral_severe;

    // Major risks excluding FRAX/Parent for differentiation
    const hasOtherMajorRisk = inputs.risk_diabetes || inputs.risk_ckd || inputs.risk_copd || inputs.risk_steroid || inputs.ckd_stage === '3' || inputs.ckd_stage === '4_5';

    if (isOsteopenia && !hasFracture && !hasOtherMajorRisk) {
        if (inputs.risk_frax || inputs.risk_parent_hip_fx) {
            return 'CASE_2'; // High Risk, Goal T >= -1.5
        }
        return 'CASE_1'; // High Risk, Goal T >= -2.0
    }
    return null;
}
