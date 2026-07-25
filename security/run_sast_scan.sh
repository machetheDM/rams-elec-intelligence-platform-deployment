#!/bin/bash
# =============================================================================
# SAST Scanning Script — Rams @Elec Intelligence Platform
# =============================================================================
# Runs all automated security scanning tools against the codebase.
# Part of ECCU510 Secure Programming (CASE) + ECCU524 Cloud Security (CCSE)
#
# Usage:
#   chmod +x security/run_sast_scan.sh
#   ./security/run_sast_scan.sh
#
# Prerequisites:
#   pip install bandit safety pip-audit
#   npm install -g eslint eslint-plugin-security
#   pip install detect-secrets
#   Install Trivy: https://github.com/aquasecurity/trivy
# =============================================================================

set -e
REPORTS_DIR="reports"
mkdir -p "$REPORTS_DIR"

echo "============================================"
echo "Rams @Elec — SAST Security Scan"
echo "============================================"
echo "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ---------------------------------------------------------------------------
# 1. Bandit — Python SAST
# ---------------------------------------------------------------------------
echo "── 1. Bandit (Python SAST) ──"
if command -v bandit &> /dev/null; then
    bandit -r services/ etl/ ml/ \
        -f json \
        -o "$REPORTS_DIR/bandit_report.json" \
        -x tests/,venv/,__pycache__/ \
        --skip B101,B104  \
        || true
    echo "  ✓ Report saved to $REPORTS_DIR/bandit_report.json"

    # Summary
    HIGH=$(python3 -c "import json; d=json.load(open('$REPORTS_DIR/bandit_report.json')); print(len([r for r in d.get('results',[]) if r.get('issue_severity')=='HIGH']))" 2>/dev/null || echo "?")
    MED=$(python3 -c "import json; d=json.load(open('$REPORTS_DIR/bandit_report.json')); print(len([r for r in d.get('results',[]) if r.get('issue_severity')=='MEDIUM']))" 2>/dev/null || echo "?")
    echo "  Findings: $HIGH HIGH, $MED MEDIUM"
else
    echo "  ⚠ Bandit not installed. Run: pip install bandit"
fi

# ---------------------------------------------------------------------------
# 2. Safety — Python Dependency CVE Check
# ---------------------------------------------------------------------------
echo ""
echo "── 2. Safety (Python Dependency Scan) ──"
if command -v safety &> /dev/null; then
    # Scan each service's requirements
    for req in services/*/requirements.txt; do
        if [ -f "$req" ]; then
            echo "  Scanning: $req"
            safety check --file="$req" --json --output="$REPORTS_DIR/safety_$(basename $(dirname $req)).json" 2>/dev/null || true
        fi
    done
    echo "  ✓ Reports saved to $REPORTS_DIR/safety_*.json"
else
    echo "  ⚠ Safety not installed. Run: pip install safety"
fi

# ---------------------------------------------------------------------------
# 3. pip-audit — Python Dependency Audit
# ---------------------------------------------------------------------------
echo ""
echo "── 3. pip-audit ──"
if command -v pip-audit &> /dev/null; then
    for req in services/*/requirements.txt; do
        if [ -f "$req" ]; then
            echo "  Auditing: $req"
            pip-audit -r "$req" --format json --output "$REPORTS_DIR/pipaudit_$(basename $(dirname $req)).json" 2>/dev/null || true
        fi
    done
    echo "  ✓ Reports saved"
else
    echo "  ⚠ pip-audit not installed. Run: pip install pip-audit"
fi

# ---------------------------------------------------------------------------
# 4. npm audit — Node.js Dependency Scan
# ---------------------------------------------------------------------------
echo ""
echo "── 4. npm audit (Node.js Dependency Scan) ──"
if [ -f "frontend/package.json" ]; then
    cd frontend
    npm audit --json > "../$REPORTS_DIR/npm_audit_report.json" 2>/dev/null || true
    cd ..
    echo "  ✓ Report saved to $REPORTS_DIR/npm_audit_report.json"
else
    echo "  ⚠ frontend/package.json not found"
fi

# ---------------------------------------------------------------------------
# 5. ESLint Security Plugin
# ---------------------------------------------------------------------------
echo ""
echo "── 5. ESLint Security Plugin ──"
if [ -f "frontend/package.json" ]; then
    cd frontend
    if command -v npx &> /dev/null; then
        npx eslint . --rule 'security/detect-object-injection: warn' \
            --rule 'security/detect-non-literal-regexp: warn' \
            --rule 'security/detect-non-literal-fs-filename: warn' \
            --rule 'security/detect-eval-with-expression: error' \
            --rule 'security/detect-child-process: warn' \
            -f json -o "../$REPORTS_DIR/eslint_security_report.json" 2>/dev/null || true
        echo "  ✓ Report saved to $REPORTS_DIR/eslint_security_report.json"
    fi
    cd ..
else
    echo "  ⚠ frontend not found"
fi

# ---------------------------------------------------------------------------
# 6. detect-secrets — Credential Scanning
# ---------------------------------------------------------------------------
echo ""
echo "── 6. detect-secrets (Credential Scan) ──"
if command -v detect-secrets &> /dev/null; then
    detect-secrets scan . \
        --all-files \
        --exclude-files '*.json' '*.csv' '*.parquet' '*.gpkg' '*.geojson' \
        > "$REPORTS_DIR/secrets_report.json" 2>/dev/null || true
    echo "  ✓ Report saved to $REPORTS_DIR/secrets_report.json"
else
    echo "  ⚠ detect-secrets not installed. Run: pip install detect-secrets"
fi

# ---------------------------------------------------------------------------
# 7. Trivy — Docker Image Scanning
# ---------------------------------------------------------------------------
echo ""
echo "── 7. Trivy (Container Image Scan) ──"
if command -v trivy &> /dev/null; then
    # Scan Dockerfiles directly (no need to build images)
    for dockerfile in docker/Dockerfile.*; do
        if [ -f "$dockerfile" ]; then
            name=$(basename "$dockerfile" | sed 's/Dockerfile\.//')
            echo "  Scanning: $dockerfile"
            trivy config "$dockerfile" \
                --format json \
                --output "$REPORTS_DIR/trivy_${name}_report.json" 2>/dev/null || true
        fi
    done
    echo "  ✓ Reports saved to $REPORTS_DIR/trivy_*_report.json"
else
    echo "  ⚠ Trivy not installed. See: https://github.com/aquasecurity/trivy"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "SCAN COMPLETE"
echo "============================================"
echo "Reports saved to: $REPORTS_DIR/"
ls -la "$REPORTS_DIR/"*.json 2>/dev/null || echo "  (no JSON reports generated)"
echo ""
echo "Next steps:"
echo "  1. Review reports in reports/"
echo "  2. See OWASP assessment: reports/owasp_assessment.md"
echo "  3. See threat model: reports/threat_model.md"
echo "  4. See full audit: reports/security_audit_report.md"
