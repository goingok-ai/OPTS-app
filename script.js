/**
 * script.js
 * UI Interaction Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const form = document.getElementById('patientForm');
    const inputs = form.querySelectorAll('input, select');
    const riskBadge = document.getElementById('riskBadge');
    const treatmentGoal = document.getElementById('treatmentGoal');
    const firstLineContent = document.getElementById('firstLineContent');
    const secondLineContent = document.getElementById('secondLineContent');
    const thirdLineContent = document.getElementById('thirdLineContent');
    const warningCard = document.getElementById('warningCard');
    const warningList = document.getElementById('warningList');

    // Conditional Sections
    const fxAnyCheckbox = document.getElementById('fx_any');
    const fractureDetails = document.getElementById('fractureDetails');

    // Event Listeners for Real-time Update
    inputs.forEach(input => {
        input.addEventListener('change', (e) => {
            // Logic: If Male, Menopause = No
            if (e.target.id === 'sex' && e.target.value === 'male') {
                const menopauseSelect = document.getElementById('menopause');
                if (menopauseSelect) menopauseSelect.value = 'no';
            }

            // Logic: Update Menopause Options based on Age/Sex
            if (e.target.id === 'age' || e.target.id === 'sex') {
                const sex = document.getElementById('sex').value;
                const age = parseInt(document.getElementById('age').value) || 0;
                const menopauseSelect = document.getElementById('menopause');
                // Find pregnancy option by value (safe for specific selection)
                // Assuming it's the 3rd option or finding by value is better
                let pregOption = null;
                for (let opt of menopauseSelect.options) {
                    if (opt.value === 'pregnancy') pregOption = opt;
                }

                if (pregOption) {
                    if (sex === 'female' && age <= 50) {
                        pregOption.hidden = false;
                        pregOption.disabled = false; // Just in case
                    } else {
                        pregOption.hidden = true;
                        pregOption.disabled = true; // Make it unselectable
                        if (menopauseSelect.value === 'pregnancy') {
                            menopauseSelect.value = 'yes'; // Reset to default
                        }
                    }
                }
            }

            updateResult();
            validateMenopauseStatus();
        });
    });

    // Age Input Validation (Force 40 if 0-39)
    const ageInput = document.getElementById('age');
    if (ageInput) {
        ageInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val >= 0 && val < 40) {
                e.target.value = 40;
            }
            // Auto-check Early Menopause
            checkAutoEarlyMenopause();
            updateResult();
            validateMenopauseStatus();
        });
    }

    // Auto-check Early Menopause on Menopause/Sex Change
    ['menopause', 'sex'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                checkAutoEarlyMenopause();
                updateResult();
                validateMenopauseStatus();
            });
        }
    });

    function validateMenopauseStatus() {
        const age = parseInt(document.getElementById('age').value) || 0;
        const menopause = document.getElementById('menopause').value;
        const menopauseGroup = document.getElementById('menopauseGroup');

        if (menopauseGroup) {
            if (age >= 60 && (menopause === 'no' || menopause === 'pregnancy')) {
                menopauseGroup.classList.add('input-warning-red');
            } else {
                menopauseGroup.classList.remove('input-warning-red');
            }
        }
    }

    function checkAutoEarlyMenopause() {
        const age = parseInt(document.getElementById('age').value);
        const sex = document.getElementById('sex').value;
        const menopause = document.getElementById('menopause').value;
        const targetCheckbox = document.getElementById('frax_secondary_menopause');

        if (targetCheckbox && sex === 'female' && menopause === 'yes' && age < 45) {
            if (!targetCheckbox.checked) {
                targetCheckbox.checked = true;
            }
        }
    }

    // Helper function for toggling visibility
    function toggleVisibility(elementId, isVisible) {
        const element = document.getElementById(elementId);
        if (element) {
            if (isVisible) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }

    // Fracture Details Toggle (Main)
    document.getElementById('fx_any').addEventListener('change', (e) => {
        toggleVisibility('fractureDetails', e.target.checked);
        // Reset sub-checkboxes if hidden
        if (!e.target.checked) {
            document.getElementById('fx_severe').checked = false;
            document.getElementById('fx_vertebral_severe').checked = false;
            document.getElementById('fx_recent_24m').checked = false;
            toggleVisibility('fx_severe_details', false);
        }
        updateResult(); // Ensure updateResult is called after changes
    });

    // Sub-Fracture Detail Toggle (Clinical -> Severe Vertebral)
    // ADDED BACK: This was missing
    const fxSevere = document.getElementById('fx_severe');
    if (fxSevere) {
        fxSevere.addEventListener('change', (e) => {
            toggleVisibility('fx_severe_details', e.target.checked);
            if (!e.target.checked) document.getElementById('fx_vertebral_severe').checked = false;
            updateResult(); // Ensure updateResult is called after changes
        });
    }

    // Morphological Fracture Toggle
    // ADDED BACK: This was missing
    const fxMorphological = document.getElementById('fx_morphological');
    if (fxMorphological) {
        fxMorphological.addEventListener('change', (e) => {
            toggleVisibility('fx_morphological_details', e.target.checked);
            if (!e.target.checked) document.getElementById('fx_morphological_severe').checked = false;
            updateResult(); // Ensure updateResult is called after changes
        });
    }

    // Toggle Risk Details
    const btnRiskDetails = document.getElementById('btn_risk_details');
    const riskDetailsContainer = document.getElementById('risk_details_container');

    btnRiskDetails.addEventListener('click', () => {
        const isHidden = riskDetailsContainer.classList.contains('hidden');
        if (isHidden) {
            riskDetailsContainer.classList.remove('hidden');
            btnRiskDetails.innerHTML = '詳細な骨折ハイリスク因子を選択 ▲';
        } else {
            riskDetailsContainer.classList.add('hidden');
            btnRiskDetails.innerHTML = '詳細な骨折ハイリスク因子を選択 ▼';
        }
    });

    // Steroid Details Toggle
    const riskSteroid = document.getElementById('risk_steroid');
    const steroidContainer = document.getElementById('steroid_details_container');
    if (riskSteroid && steroidContainer) {
        riskSteroid.addEventListener('change', (e) => {
            if (e.target.checked) {
                steroidContainer.style.display = 'block';
            } else {
                steroidContainer.style.display = 'none';
                // Reset inputs if unchecked (optional but cleaner)
                const currentCheck = document.getElementById('steroid_current');
                if (currentCheck) currentCheck.checked = false;
                const radios = document.getElementsByName('steroid_dose');
                radios.forEach(r => r.checked = false);
            }
            updateResult();
        });
        // Listen for dose changes to update result immediately
        const doses = document.getElementsByName('steroid_dose');
        doses.forEach(d => {
            d.addEventListener('change', updateResult);
        });
    }

    // Helper: Menopause Visibility
    function updateMenopauseVisibility() {
        const sex = document.getElementById('sex').value;
        const menopauseSelect = document.getElementById('menopause');
        if (menopauseSelect) {
            const container = menopauseSelect.closest('.form-group');
            if (container) {
                if (sex === 'male') {
                    container.style.display = 'none';
                    menopauseSelect.value = 'no';
                } else {
                    container.style.display = 'block';
                }
            }
        }
    }

    // Initial Calculation
    updateMenopauseVisibility();
    updateResult();

    function updateResult() {
        try {
            const formData = getFormData();
            const resultColumn = document.getElementById('result_column');

            // Check required fields logic (Relaxed)
            const canProceed = (formData.t_group && formData.t_group !== '') ||
                (formData.ckd_stage && formData.ckd_stage !== '') ||
                formData.fx_any ||
                formData.fx_morphological;

            if (!canProceed) {
                if (resultColumn) resultColumn.classList.add('hidden');
                return;
            }
            if (resultColumn) resultColumn.classList.remove('hidden');

            const result = evaluateTreatment(formData);

            // Render Results
            renderRisk(result.risk);
            renderGoal(result.goal);
            renderTreatment(result.treatment);
            renderWarnings(result.warnings);
            if (typeof updateMenopauseVisibility === 'function') updateMenopauseVisibility();

            // FRAX Card Visibility Logic
            const fraxContainer = document.getElementById('frax_check_container');
            const isEarlyMenopause = (formData.sex === 'female' && formData.age < 45 && formData.menopause === 'yes');
            // User Request: Always show if BMD is Normal or Osteopenia (t_group >= -2.5)
            const isBmdNormalOrOsteopenia = (formData.t_group === 'ge_-1.0' || formData.t_group === '-2.5_to_-1.0');

            if (result.risk === 'Low' || isEarlyMenopause || isBmdNormalOrOsteopenia) {
                fraxContainer.style.display = 'block';
                fraxContainer.classList.remove('hidden');
            } else {
                fraxContainer.style.display = 'none';
                fraxContainer.classList.add('hidden');
            }

            // Rare Case Warning Logic
            const rareCaseContainer = document.getElementById('rare_case_warning_container');
            if (result.treatment && result.treatment.isRareCase) {
                rareCaseContainer.style.display = 'block';
                rareCaseContainer.classList.remove('hidden');
            } else {
                rareCaseContainer.style.display = 'none';
                rareCaseContainer.classList.add('hidden');
            }

            // Menopausal Transition Logic
            const menopausalContainer = document.getElementById('menopausal_transition_container');
            if (result.treatment && result.treatment.isMenopausalTransition) {
                menopausalContainer.style.display = 'block';
                menopausalContainer.classList.remove('hidden');
            } else {
                menopausalContainer.style.display = 'none';
                menopausalContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error in updateResult:", error);
            const resultColumn = document.getElementById('result_column');
            if (resultColumn) resultColumn.classList.add('hidden');
        }
    }

    function getFormData() {
        return {
            sex: document.getElementById('sex').value,
            age: parseInt(document.getElementById('age').value) || 0,
            menopause: document.getElementById('menopause').value,

            fx_any: document.getElementById('fx_any').checked,
            fx_severe: document.getElementById('fx_severe').checked,
            fx_vertebral_severe: document.getElementById('fx_vertebral_severe').checked,
            fx_recent_24m: document.getElementById('fx_recent_24m').checked,
            fx_morphological: document.getElementById('fx_morphological').checked,
            fx_morphological_severe: document.getElementById('fx_morphological_severe').checked,

            // New Detailed Risk Factors
            // Logic Update: Steroid Risk only true if dose is 5mg or more (5-7.5Mg or >=7.5mg)
            risk_steroid: (() => {
                const isChecked = document.getElementById('risk_steroid').checked;
                if (!isChecked) return false;
                const dose5_75 = document.querySelector('input[name="steroid_dose"][value="5_to_7.5"]')?.checked;
                const doseGe75 = document.querySelector('input[name="steroid_dose"][value="ge_7.5"]')?.checked;
                return dose5_75 || doseGe75;
            })(),
            // Raw Steroid Data for GIO Logic
            steroid_current: document.getElementById('steroid_current').checked,
            steroid_dose: (() => {
                const checked = document.querySelector('input[name="steroid_dose"]:checked');
                return checked ? checked.value : null;
            })(),
            risk_parent_hip_fx: document.getElementById('risk_parent_hip_fx').checked,
            risk_frax: document.getElementById('risk_frax').checked,
            risk_diabetes: document.getElementById('risk_diabetes').checked,
            risk_ckd: document.getElementById('risk_ckd').checked,
            risk_antihormonal: document.getElementById('risk_antihormonal').checked,
            risk_copd: document.getElementById('risk_copd').checked,
            frax_early_menopause: document.getElementById('frax_secondary_menopause').checked,
            // risk_ra, risk_sec_op, risk_alcohol, risk_smoking removed as they are not in main risk list IDs

            t_group: document.getElementById('t_group').value,
            ckd_stage: document.getElementById('ckd_stage').value,
            cv_event_recent_12m: document.getElementById('cv_event_recent_12m').checked,
            hypocalcemia_risk: document.getElementById('hypocalcemia_risk').checked,
            contraindication_pth: document.getElementById('contraindication_pth').checked,
            injectable: document.getElementById('injectable').checked
        };
    }

    // --- FRAX Calculator Logic (Event Delegation) ---
    function initFraxSupport() {
        const fraxInputs = document.getElementById('frax_inputs');

        // Initial Sync
        const yesRadio = document.getElementById('frax_toggle_yes');
        if (yesRadio && yesRadio.checked) {
            if (fraxInputs) {
                fraxInputs.classList.remove('hidden');
                fraxInputs.style.display = 'block';
            }
        }

        // Global Event Delegation for Toggle
        document.body.addEventListener('change', (e) => {
            if (e.target.name === 'calc_frax_toggle') {
                if (fraxInputs) {
                    if (e.target.value === 'yes') {
                        fraxInputs.classList.remove('hidden');
                        fraxInputs.style.display = 'block';
                    } else {
                        fraxInputs.classList.add('hidden');
                        fraxInputs.style.display = 'none';
                    }
                }
            }
        });

        // Calculation Button Logic
        const btnCalcFrax = document.getElementById('btn_calc_frax');
        if (btnCalcFrax) {
            btnCalcFrax.addEventListener('click', () => {
                try {
                    const formData = getFormData();
                    const fraxData = getFraxInputs();
                    const mapping = mapToFrax(formData, fraxData);
                    showFraxInstructions(mapping);
                } catch (e) {
                    console.error(e);
                    alert("詳細: " + e.message);
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFraxSupport);
    } else {
        initFraxSupport();
    }

    function getFraxInputs() {
        return {
            // Height/Weight removed from UI
            alcohol: document.getElementById('frax_alcohol').checked,
            smoking: document.getElementById('frax_smoking').checked,
            // Secondary OP items
            sec_digestive: document.getElementById('frax_secondary_digestive').checked,
            sec_menopause: document.getElementById('frax_secondary_menopause').checked,
            sec_ra: document.getElementById('frax_ra').checked,
            // Other diseases (Secondary OP)
            sec_type1dm: document.getElementById('frax_sec_type1dm').checked,
            sec_hyperthyro: document.getElementById('frax_sec_hyperthyro').checked,
            sec_oi: document.getElementById('frax_sec_oi').checked,
            sec_hepatitis: document.getElementById('frax_sec_hepatitis').checked,
            sec_uc: document.getElementById('frax_sec_uc').checked,
            sec_crohn: document.getElementById('frax_sec_crohn').checked
        };
    }

    function mapToFrax(appData, fraxData) {
        // 10. Secondary Osteoporosis Logic
        // Defined in prompt: CKD3+, Diabetes, COPD, Hormone, or any new list item EXCEPT RA/Smoking/Alcohol
        const hasSecondaryOP =
            // Explicit Exclusions per user request: CKD, T2 Diabetes, COPD
            // Included:
            fraxData.sec_type1dm || // Type 1 DM (New)
            appData.risk_hormone ||
            fraxData.sec_digestive ||
            fraxData.sec_menopause ||
            fraxData.sec_hyperthyro ||
            fraxData.sec_oi ||
            fraxData.sec_hepatitis || // Chronic Hepatitis (New)
            fraxData.sec_uc ||
            fraxData.sec_crohn;

        return {
            age: appData.age,
            sex: appData.sex,
            // weight/height not collected
            prev_fracture: appData.fx_any,
            parent_hip_fracture: appData.risk_parent_hip_fx,
            smoking: fraxData.smoking,
            steroid: appData.risk_steroid,
            ra: fraxData.sec_ra,
            secondary_op: hasSecondaryOP,
            alcohol: fraxData.alcohol
        };
    }

    function showFraxInstructions(mapping) {
        const resultArea = document.getElementById('frax_result_area');
        const resultContent = document.getElementById('frax_result_content');

        const row = (num, label, value, isYes) => `
            <tr>
                <th>${num}</th>
                <td>${label}</td>
                <td class="${isYes ? 'val-yes' : 'val-no'}">${value}</td>
            </tr>
        `;

        const html = `
            <table class="result-list-table">
                ${row(1, '年齢', mapping.age, false)}
                ${row(2, '性別', mapping.sex === 'female' ? '女性' : '男性', false)}
                ${row(3, '重量', '体重(kg)を入力', true)}
                ${row(4, '高さ', '身長(cm)を入力', true)}
                ${row(5, '前回の骨折', mapping.prev_fracture ? 'あり (YES)' : 'なし', mapping.prev_fracture)}
                ${row(6, '両親の股関節骨折', mapping.parent_hip_fracture ? 'あり (YES)' : 'なし', mapping.parent_hip_fracture)}
                ${row(7, '現在喫煙中', mapping.smoking ? 'あり (YES)' : 'なし', mapping.smoking)}
                ${row(8, 'グルココルチコイド', mapping.steroid ? 'あり (YES)' : 'なし', mapping.steroid)}
                ${row(9, '関節リウマチ', mapping.ra ? 'あり (YES)' : 'なし', mapping.ra)}
                ${row(10, '二次性骨粗鬆症', mapping.secondary_op ? 'あり (YES)' : 'なし', mapping.secondary_op)}
                ${row(11, 'アルコール(1日エタノール24g以上)', mapping.alcohol ? 'あり (YES)' : 'なし', mapping.alcohol)}
                ${row(12, '大腿骨頸部BMD', '骨密度＋測定機器メーカー入力<br>もしくは T score入力すると精度アップ<br>入力しないでもOK', true)}
            </table>
        `;

        resultContent.innerHTML = html;
        resultArea.classList.remove('hidden');

        // Scroll to result
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderRisk(risk) {
        const card = document.getElementById('riskCard');
        if (!risk) {
            if (card) card.classList.add('hidden');
            return;
        }
        if (card) card.classList.remove('hidden');

        const badge = document.getElementById('riskBadge');
        if (badge) {
            badge.textContent = risk === 'Unknown' ? '判定不能' : risk;
            badge.className = 'risk-badge';
            badge.style.backgroundColor = ''; // Reset inline style
            badge.style.color = '';

            switch (risk) {
                case 'Very High':
                    badge.classList.add('risk-very-high');
                    break;
                case 'High':
                    badge.classList.add('risk-high');
                    break;
                case 'Low':
                    badge.classList.add('risk-low');
                    break;
                case 'Unknown':
                    badge.style.backgroundColor = '#6c757d';
                    badge.style.color = '#fff';
                    break;
            }
        }
    }

    function renderGoal(goalText) {
        const goalEl = document.getElementById('treatmentGoal');
        if (goalEl) goalEl.textContent = goalText || '---';
    }

    function renderTreatment(treatment) {
        const card = document.querySelector('.recommendation-card');
        const menopausalContainer = document.getElementById('menopausal_transition_container');

        if (!treatment) {
            if (card) card.classList.add('hidden');
            if (menopausalContainer) {
                menopausalContainer.style.display = 'none';
                menopausalContainer.classList.add('hidden');
            }
            return;
        }
        if (card) card.classList.remove('hidden');

        // Menopausal Transition Alert Logic
        if (menopausalContainer) {
            if (treatment.isMenopausalTransition) {
                menopausalContainer.style.display = 'block';
                menopausalContainer.classList.remove('hidden');
            } else {
                menopausalContainer.style.display = 'none';
                menopausalContainer.classList.add('hidden');
            }
        }

        // Animation effect for updates
        // Animation effect for updates
        const updateLine = (element, text, note) => {
            element.innerHTML = '';
            if (!text || text === "---") {
                element.innerHTML = '<p class="placeholder-text">---</p>';
                return;
            }

            const p = document.createElement('p');
            p.innerHTML = linkifyDrugs(text);
            element.appendChild(p);

            if (note) {
                const small = document.createElement('small');
                small.style.display = 'block';
                small.style.color = '#6c757d';
                small.style.marginTop = '4px';
                small.innerHTML = linkifyDrugs(note);
                element.appendChild(small);
            }
        };

        updateLine(firstLineContent, treatment.first_line, treatment.note); // Note primarily attached to 1st line or general
        updateLine(secondLineContent, treatment.second_line);
        updateLine(thirdLineContent, treatment.third_line);
    }

    function renderWarnings(warnings) {
        // CKD Special Warning Control
        const ckdStage = document.getElementById('ckd_stage').value;
        const ckd45Container = document.getElementById('ckd_warning_container');
        const ckd3Container = document.getElementById('ckd3_warning_container');

        // Reset both
        ckd45Container.style.display = 'none';
        ckd45Container.classList.add('hidden');
        ckd3Container.style.display = 'none';
        ckd3Container.classList.add('hidden');

        if (ckdStage === '4_5') {
            ckd45Container.style.display = 'block';
            ckd45Container.classList.remove('hidden');
        } else if (ckdStage === '3') {
            ckd3Container.style.display = 'block';
            ckd3Container.classList.remove('hidden');
        }

        // Recent Fracture Warning
        const recentFxContainer = document.getElementById('recent_fx_warning_container');
        const isRecentFx = document.getElementById('fx_recent_24m').checked;

        if (isRecentFx) {
            recentFxContainer.style.display = 'block';
            recentFxContainer.classList.remove('hidden');
        } else {
            recentFxContainer.style.display = 'none';
            recentFxContainer.classList.add('hidden');
        }

        // BMD Warning Logic
        const bmdContainer = document.getElementById('bmd_warning_container');
        const bmdUnknown = document.getElementById('t_group').value === 'unknown';

        // GIO Warning logic
        const gioContainer = document.getElementById('gio_warning_container');
        const isSteroidCurrent = document.getElementById('steroid_current').checked;

        if (gioContainer) {
            if (isSteroidCurrent) {
                gioContainer.style.display = 'block';
                gioContainer.classList.remove('hidden');
            } else {
                gioContainer.style.display = 'none';
                gioContainer.classList.add('hidden');
            }
        }

        // Re-evaluate risk factors (need access to formData logic here, using inputs directly)
        // We can check result.inputs if we passed it back, or just re-read DOM since we are in script.js
        const age = parseInt(document.getElementById('age').value) || 0;
        const sex = document.getElementById('sex').value;
        const fxAny = document.getElementById('fx_any').checked;

        // Check for ANY risk factor (simplified check for "Detailed Risk Factors")
        // We need to know if there are "Detailed Risk Factors" or "Secondary OP"
        // Let's use getFormData() logic or helper if available, or manual check.
        const hasRiskFactor =
            document.getElementById('fx_any').checked || // Although fracture is handled separately, it implies risk
            document.getElementById('risk_steroid').checked ||
            document.getElementById('risk_parent_hip_fx').checked ||
            document.getElementById('risk_frax').checked ||
            document.getElementById('risk_diabetes').checked ||
            document.getElementById('risk_ckd').checked ||
            document.getElementById('risk_copd').checked ||
            ckdStage === '3' || ckdStage === '4_5'; // CKD is a risk

        let showBmdWarning = false;

        // Check both DOM value and Logic flag
        if (bmdUnknown || (warnings && warnings.includes('bmd_recommended'))) {
            showBmdWarning = true;
        }

        if (showBmdWarning) {
            bmdContainer.style.display = 'block';
            bmdContainer.classList.remove('hidden');
        } else {
            bmdContainer.style.display = 'none';
            bmdContainer.classList.add('hidden');
        }

        // Filter out control flags like 'bmd_recommended'
        const textWarnings = warnings ? warnings.filter(w => w !== 'bmd_recommended') : [];

        if (textWarnings.length === 0) {
            warningCard.style.display = 'none';
            return;
        }

        warningCard.style.display = 'block';
        warningList.innerHTML = '';
        textWarnings.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            if (msg.includes('CRITICAL')) {
                li.style.color = '#dc3545';
                li.style.fontWeight = 'bold';
            }
            warningList.appendChild(li);
        });
    }
    // --- DI Modal Logic ---
    const drugData = {
        'ロモソズマブ': {
            indication: '骨折の危険性の高い骨粗鬆症',
            contraindication: ['低カルシウム血症', '本成分に対する過敏症の既往'],
            caution: ['虚血性心疾患、脳血管障害の既往または高リスク', '重度腎機能障害、透析患者（低カルシウム血症リスク）', '妊婦・授乳婦・小児'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00067879'
        },
        'テリパラチド': {
            indication: '骨折の危険性の高い骨粗鬆症<br>効能効果；低骨密度、既存骨折、加齢、大腿骨頸部骨折の家族歴等の骨折の危険因子を有する患者を対象とすること。',
            contraindication: ['高カルシウム血症', '骨肉腫のリスクが高い患者（骨Paget病、原因不明のALP高値、放射線治療歴など）', '原発性悪性骨腫瘍、転移性骨腫瘍', '副甲状腺機能亢進症', '妊婦', '本成分に対する過敏症'],
            caution: ['腎機能障害', '重度の肝機能障害', '尿路結石の既往', '閉経前骨粗鬆症', '低血圧', '心疾患のある患者', '高齢者', '妊婦・授乳婦・生殖能を有する患者・小児'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00068290'
        },
        'アバロパラチド': {
            indication: '骨折の危険性の高い骨粗鬆症<br>効能効果；低骨密度、既存骨折、加齢、大腿骨頸部骨折の家族歴等の骨折の危険因子を有する患者を対象とすること。',
            contraindication: ['高カルシウム血症', '骨肉腫のリスクが高い患者（骨Paget病、原因不明のALP高値、放射線治療歴など）', '原発性悪性骨腫瘍、転移性骨腫瘍', '副甲状腺機能亢進症', '妊婦', '本成分に対する過敏症'],
            caution: ['腎機能障害', '重度の肝機能障害', '尿路結石の既往', '閉経前骨粗鬆症', '心疾患のある患者', '妊婦・授乳婦・生殖のを有する患者・小児'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00070615'
        },
        'デノスマブ': {
            indication: '骨粗鬆症',
            contraindication: ['低カルシウム血症', '本成分に対する過敏症'],
            caution: ['重度腎機能障害・透析（低Ca血症リスク）', '顎骨壊死リスク（侵襲的歯科処置予定）', '感染症リスクの高い患者'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00061356'
        },
        'ビスホスホネート': {
            indication: '骨粗鬆症',
            contraindication: ['低カルシウム血症', '食道通過障害（経口薬）30分以上上体を起こしていられない患者', '重度腎機能障害（eGFR目安 <30–35）', '本成分に対する過敏症'],
            caution: ['上部消化管障害', '顎骨壊死リスク', '生殖能を有する患者', '妊婦・授乳婦・小児'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00060152'
        },
        'ビスホスホネート製剤': {
            indication: '骨粗鬆症',
            contraindication: ['低カルシウム血症', '食道通過障害（経口薬）30分以上上体を起こしていられない患者', '重度腎機能障害（eGFR目安 <30–35）', '本成分に対する過敏症'],
            caution: ['上部消化管障害', '顎骨壊死リスク', '生殖能を有する患者', '妊婦・授乳婦・小児'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00060152'
        },
        'SERM': {
            indication: '閉経後骨粗鬆症',
            contraindication: ['静脈血栓塞栓症の既往', '長期不動状態（術後回復期・長期案正規）', '妊婦・授乳婦', '抗リン脂質抗体症候群', '本成分に対する過敏症'],
            caution: ['経口エストロゲン療法にて顕著な高TG血症の既往のある患者', '肝機能障害', '腎機能障害', '妊婦・授乳婦'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00058862'
        },
        'エルデカルシトール': {
            indication: '骨粗鬆症',
            contraindication: ['妊婦・授乳婦', '過敏症', '高カルシウム血症'],
            caution: ['腎機能障害', '尿路結石の既往', '高Ca血症を起こしやすい患者', '生殖能を有する患者'],
            link: 'https://www.kegg.jp/medicus-bin/japic_med?japic_code=00068630'
        }
    };

    function linkifyDrugs(text) {
        if (!text) return text;
        let linkedText = text;
        const keywords = Object.keys(drugData).sort((a, b) => b.length - a.length);

        keywords.forEach((keyword, index) => {
            const regex = new RegExp(`(${keyword})`, 'g');
            linkedText = linkedText.replace(regex, `___DRUG_${index}___`);
        });

        keywords.forEach((keyword, index) => {
            const regex = new RegExp(`___DRUG_${index}___`, 'g');
            linkedText = linkedText.replace(regex, `<span class="drug-link" data-drug="${keyword}">${keyword}</span>`);
        });

        return linkedText;
    }

    const modal = document.getElementById('diModal');
    const closeBtn = document.querySelector('.close-modal');
    const diContent = document.getElementById('diContent');

    if (closeBtn) {
        closeBtn.onclick = function () {
            modal.classList.add('hidden');
        }
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.classList.add('hidden');
        }
    }

    document.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('drug-link')) {
            const drugName = e.target.getAttribute('data-drug');
            showDrugInfo(drugName);
        }
    });

    function showDrugInfo(drugName) {
        const data = drugData[drugName];
        if (data) {
            renderDI(drugName, data);
            modal.classList.remove('hidden');
        }
    }

    function renderDI(title, data) {
        let html = `<div class="di-title">${title}</div>`;

        if (data.indication) {
            html += `<div class="di-section">
                <h4>適応</h4>
                <div class="di-text-content">${data.indication}</div>
             </div>`;
        }

        if (data.contraindication) {
            html += `<div class="di-section">
                <h4>禁忌</h4>
                <div>${data.contraindication.map(item => `<div class="di-block"><span class="di-label contra">禁忌</span> <span class="di-text-content">${item}</span></div>`).join('')}</div>
             </div>`;
        }

        if (data.caution) {
            html += `<div class="di-section">
                <h4>慎重投与</h4>
                <div>${data.caution.map(item => `<div class="di-block"><span class="di-label caution">慎重</span> <span class="di-text-content">${item}</span></div>`).join('')}</div>
             </div>`;
        }

        if (data.link) {
            html += `<div style="text-align: center; margin-top: 20px;">
                <a href="${data.link}" target="_blank" class="di-link">最新のDIを確認 (KEGG)</a>
              </div>`;
        }

        diContent.innerHTML = html;
    }

    // --- Service Worker Registration (PWA) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
            console.log('Service Worker Registered');
        });
    }

});
