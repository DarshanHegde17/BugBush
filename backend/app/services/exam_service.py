import os
import uuid
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any

from backend.app.code_execution.sandbox import code_sandbox
from backend.app.services.user_service import user_service

logger = logging.getLogger("bugbash.exam_service")


class ExamService:
    """
    Core Examination Engine for BugBash Assessments:
    - Server-authoritative timer and attempt session state management
    - Isolated code execution and sample test runner
    - Official multi-test-case evaluation pipeline
    - Auto-save drafts with ownership verification
    - Proctoring telemetry event logging
    - Multi-language support: Python, JavaScript, C++, C, Java
    """

    def __init__(self):
        # In-memory attempts session cache: { attempt_id: attempt_dict }
        self._attempts: Dict[str, dict] = {}

        # Questions Catalog
        self._questions: Dict[str, dict] = {
            "q-101": {
                "id": "q-101",
                "order": 1,
                "title": "Optimized Two-Sum with Hash Map",
                "difficulty": "Easy",
                "category": "Arrays & Hash Table",
                "points": 25,
                "description": (
                    "Given an array of integers `nums` and an integer `target`, return the 0-indexed indices "
                    "of the two numbers such that they add up to `target`.\n\n"
                    "You may assume that each input has **exactly one solution**, and you may not use the "
                    "same element twice. You can return the answer in any order (indices separated by a space)."
                ),
                "input_format": (
                    "First line: Integer `n` (array length).\n"
                    "Second line: `n` space-separated integers representing `nums`.\n"
                    "Third line: Integer `target`."
                ),
                "output_format": "Two space-separated integers representing the indices.",
                "constraints": [
                    "2 <= nums.length <= 10^4",
                    "-10^9 <= nums[i] <= 10^9",
                    "-10^9 <= target <= 10^9",
                    "Only one valid answer exists."
                ],
                "examples": [
                    {
                        "input": "4\n2 7 11 15\n9",
                        "output": "0 1",
                        "explanation": "Because nums[0] + nums[1] == 2 + 7 == 9, we return 0 1."
                    },
                    {
                        "input": "3\n3 2 4\n6",
                        "output": "1 2",
                        "explanation": "Because nums[1] + nums[2] == 2 + 4 == 6, we return 1 2."
                    }
                ],
                "sample_test_cases": [
                    {"input": "4\n2 7 11 15\n9", "output": "0 1"},
                    {"input": "3\n3 2 4\n6", "output": "1 2"}
                ],
                "hidden_test_cases": [
                    {"input": "2\n3 3\n6", "output": "0 1"},
                    {"input": "5\n-3 4 3 90 2\n0", "output": "0 2"},
                    {"input": "6\n1 5 3 7 9 2\n16", "output": "3 4"}
                ],
                "allowed_languages": ["Python", "JavaScript", "C++", "C", "Java"],
                "starter_code": {
                    "Python": (
                        "import sys\n\n"
                        "def solve():\n"
                        "    tokens = sys.stdin.read().split()\n"
                        "    if not tokens:\n"
                        "        return\n"
                        "    n = int(tokens[0])\n"
                        "    nums = [int(x) for x in tokens[1:n+1]]\n"
                        "    target = int(tokens[n+1])\n"
                        "    \n"
                        "    # TODO: Implement optimized hash map lookup\n"
                        "    seen = {}\n"
                        "    for i, num in enumerate(nums):\n"
                        "        comp = target - num\n"
                        "        if comp in seen:\n"
                        "            print(f\"{seen[comp]} {i}\")\n"
                        "            return\n"
                        "        seen[num] = i\n\n"
                        "if __name__ == '__main__':\n"
                        "    solve()\n"
                    ),
                    "JavaScript": (
                        "const fs = require('fs');\n\n"
                        "function solve() {\n"
                        "    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n"
                        "    if (input.length < 3) return;\n"
                        "    const n = parseInt(input[0], 10);\n"
                        "    const nums = input.slice(1, n + 1).map(Number);\n"
                        "    const target = parseInt(input[n + 1], 10);\n\n"
                        "    const map = new Map();\n"
                        "    for (let i = 0; i < nums.length; i++) {\n"
                        "        const comp = target - nums[i];\n"
                        "        if (map.has(comp)) {\n"
                        "            console.log(`${map.get(comp)} ${i}`);\n"
                        "            return;\n"
                        "        }\n"
                        "        map.set(nums[i], i);\n"
                        "    }\n"
                        "}\n\n"
                        "solve();\n"
                    ),
                    "C++": (
                        "#include <iostream>\n"
                        "#include <vector>\n"
                        "#include <unordered_map>\n"
                        "using namespace std;\n\n"
                        "int main() {\n"
                        "    ios_base::sync_with_stdio(false);\n"
                        "    cin.tie(NULL);\n"
                        "    int n;\n"
                        "    if (!(cin >> n)) return 0;\n"
                        "    vector<int> nums(n);\n"
                        "    for (int i = 0; i < n; i++) cin >> nums[i];\n"
                        "    int target;\n"
                        "    cin >> target;\n\n"
                        "    unordered_map<int, int> seen;\n"
                        "    for (int i = 0; i < n; i++) {\n"
                        "        int comp = target - nums[i];\n"
                        "        if (seen.count(comp)) {\n"
                        "            cout << seen[comp] << \" \" << i << \"\\n\";\n"
                        "            return 0;\n"
                        "        }\n"
                        "        seen[nums[i]] = i;\n"
                        "    }\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "C": (
                        "#include <stdio.h>\n"
                        "#include <stdlib.h>\n\n"
                        "int main() {\n"
                        "    int n;\n"
                        "    if (scanf(\"%d\", &n) != 1) return 0;\n"
                        "    int *nums = (int*)malloc(sizeof(int) * n);\n"
                        "    for (int i = 0; i < n; i++) scanf(\"%d\", &nums[i]);\n"
                        "    int target;\n"
                        "    scanf(\"%d\", &target);\n\n"
                        "    for (int i = 0; i < n; i++) {\n"
                        "        for (int j = i + 1; j < n; j++) {\n"
                        "            if (nums[i] + nums[j] == target) {\n"
                        "                printf(\"%d %d\\n\", i, j);\n"
                        "                free(nums);\n"
                        "                return 0;\n"
                        "            }\n"
                        "        }\n"
                        "    }\n"
                        "    free(nums);\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "Java": (
                        "import java.util.*;\n\n"
                        "public class Main {\n"
                        "    public static void main(String[] args) {\n"
                        "        Scanner sc = new Scanner(System.in);\n"
                        "        if (!sc.hasNextInt()) return;\n"
                        "        int n = sc.nextInt();\n"
                        "        int[] nums = new int[n];\n"
                        "        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n"
                        "        int target = sc.nextInt();\n\n"
                        "        Map<Integer, Integer> map = new HashMap<>();\n"
                        "        for (int i = 0; i < n; i++) {\n"
                        "            int comp = target - nums[i];\n"
                        "            if (map.containsKey(comp)) {\n"
                        "                System.out.println(map.get(comp) + \" \" + i);\n"
                        "                return;\n"
                        "            }\n"
                        "            map.put(nums[i], i);\n"
                        "        }\n"
                        "    }\n"
                        "}\n"
                    )
                }
            },
            "q-102": {
                "id": "q-102",
                "order": 2,
                "title": "Longest Substring Without Repeating Characters",
                "difficulty": "Medium",
                "category": "Strings & Sliding Window",
                "points": 35,
                "description": (
                    "Given a string `s`, find the length of the **longest substring** without duplicate characters.\n\n"
                    "A substring is a contiguous non-empty sequence of characters within a string."
                ),
                "input_format": "A single line containing the string `s`.",
                "output_format": "A single integer denoting the length of the longest substring without repeats.",
                "constraints": [
                    "0 <= s.length <= 5 * 10^4",
                    "`s` consists of English letters, digits, symbols and spaces."
                ],
                "examples": [
                    {
                        "input": "abcabcbb",
                        "output": "3",
                        "explanation": "The answer is 'abc', with the length of 3."
                    },
                    {
                        "input": "bbbbb",
                        "output": "1",
                        "explanation": "The answer is 'b', with the length of 1."
                    },
                    {
                        "input": "pwwkew",
                        "output": "3",
                        "explanation": "The answer is 'wke', with the length of 3."
                    }
                ],
                "sample_test_cases": [
                    {"input": "abcabcbb", "output": "3"},
                    {"input": "bbbbb", "output": "1"}
                ],
                "hidden_test_cases": [
                    {"input": "pwwkew", "output": "3"},
                    {"input": "au", "output": "2"},
                    {"input": "tmmzuxt", "output": "5"}
                ],
                "allowed_languages": ["Python", "JavaScript", "C++", "C", "Java"],
                "starter_code": {
                    "Python": (
                        "import sys\n\n"
                        "def length_of_longest_substring(s: str) -> int:\n"
                        "    char_map = {}\n"
                        "    left = 0\n"
                        "    max_len = 0\n"
                        "    for right, ch in enumerate(s):\n"
                        "        if ch in char_map and char_map[ch] >= left:\n"
                        "            left = char_map[ch] + 1\n"
                        "        char_map[ch] = right\n"
                        "        max_len = max(max_len, right - left + 1)\n"
                        "    return max_len\n\n"
                        "if __name__ == '__main__':\n"
                        "    line = sys.stdin.readline().rstrip('\\r\\n')\n"
                        "    print(length_of_longest_substring(line))\n"
                    ),
                    "JavaScript": (
                        "const fs = require('fs');\n\n"
                        "function solve() {\n"
                        "    const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');\n"
                        "    const map = new Map();\n"
                        "    let left = 0, maxLen = 0;\n"
                        "    for (let right = 0; right < input.length; right++) {\n"
                        "        const ch = input[right];\n"
                        "        if (map.has(ch) && map.get(ch) >= left) {\n"
                        "            left = map.get(ch) + 1;\n"
                        "        }\n"
                        "        map.set(ch, right);\n"
                        "        maxLen = Math.max(maxLen, right - left + 1);\n"
                        "    }\n"
                        "    console.log(maxLen);\n"
                        "}\n\n"
                        "solve();\n"
                    ),
                    "C++": (
                        "#include <iostream>\n"
                        "#include <string>\n"
                        "#include <unordered_map>\n"
                        "#include <algorithm>\n"
                        "using namespace std;\n\n"
                        "int main() {\n"
                        "    string s;\n"
                        "    if (!getline(cin, s)) { cout << 0 << endl; return 0; }\n"
                        "    unordered_map<char, int> map;\n"
                        "    int left = 0, max_len = 0;\n"
                        "    for (int right = 0; right < s.length(); right++) {\n"
                        "        if (map.count(s[right]) && map[s[right]] >= left) {\n"
                        "            left = map[s[right]] + 1;\n"
                        "        }\n"
                        "        map[s[right]] = right;\n"
                        "        max_len = max(max_len, right - left + 1);\n"
                        "    }\n"
                        "    cout << max_len << endl;\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "C": (
                        "#include <stdio.h>\n"
                        "#include <string.h>\n\n"
                        "int main() {\n"
                        "    char s[60000];\n"
                        "    if (!fgets(s, sizeof(s), stdin)) { printf(\"0\\n\"); return 0; }\n"
                        "    int len = strlen(s);\n"
                        "    if (len > 0 && s[len-1] == '\\n') s[--len] = '\\0';\n"
                        "    int last[256];\n"
                        "    memset(last, -1, sizeof(last));\n"
                        "    int left = 0, max_len = 0;\n"
                        "    for (int r = 0; r < len; r++) {\n"
                        "        unsigned char c = (unsigned char)s[r];\n"
                        "        if (last[c] >= left) left = last[c] + 1;\n"
                        "        last[c] = r;\n"
                        "        if (r - left + 1 > max_len) max_len = r - left + 1;\n"
                        "    }\n"
                        "    printf(\"%d\\n\", max_len);\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "Java": (
                        "import java.util.*;\n\n"
                        "public class Main {\n"
                        "    public static void main(String[] args) {\n"
                        "        Scanner sc = new Scanner(System.in);\n"
                        "        String s = sc.hasNextLine() ? sc.nextLine() : \"\";\n"
                        "        Map<Character, Integer> map = new HashMap<>();\n"
                        "        int left = 0, maxLen = 0;\n"
                        "        for (int r = 0; r < s.length(); r++) {\n"
                        "            char ch = s.charAt(r);\n"
                        "            if (map.containsKey(ch) && map.get(ch) >= left) {\n"
                        "                left = map.get(ch) + 1;\n"
                        "            }\n"
                        "            map.put(ch, r);\n"
                        "            maxLen = Math.max(maxLen, r - left + 1);\n"
                        "        }\n"
                        "        System.out.println(maxLen);\n"
                        "    }\n"
                        "}\n"
                    )
                }
            },
            "q-103": {
                "id": "q-103",
                "order": 3,
                "title": "Maximum Subarray Sum (Kadane's Algorithm)",
                "difficulty": "Medium",
                "category": "Dynamic Programming & Arrays",
                "points": 40,
                "description": (
                    "Given an integer array `nums`, find the contiguous subarray (containing at least one number) "
                    "which has the largest sum and return **its sum**.\n\n"
                    "A subarray is a contiguous part of an array."
                ),
                "input_format": (
                    "First line: Integer `n` (array length).\n"
                    "Second line: `n` space-separated integers representing `nums`."
                ),
                "output_format": "A single integer representing the maximum subarray sum.",
                "constraints": [
                    "1 <= nums.length <= 10^5",
                    "-10^4 <= nums[i] <= 10^4"
                ],
                "examples": [
                    {
                        "input": "9\n-2 1 -3 4 -1 2 1 -5 4",
                        "output": "6",
                        "explanation": "[4, -1, 2, 1] has the largest sum = 6."
                    },
                    {
                        "input": "1\n1",
                        "output": "1",
                        "explanation": "The single element [1] has the largest sum = 1."
                    },
                    {
                        "input": "5\n5 4 -1 7 8",
                        "output": "23",
                        "explanation": "[5, 4, -1, 7, 8] has the largest sum = 23."
                    }
                ],
                "sample_test_cases": [
                    {"input": "9\n-2 1 -3 4 -1 2 1 -5 4", "output": "6"},
                    {"input": "1\n1", "output": "1"}
                ],
                "hidden_test_cases": [
                    {"input": "5\n5 4 -1 7 8", "output": "23"},
                    {"input": "3\n-3 -2 -1", "output": "-1"},
                    {"input": "4\n-1 -2 -3 -4", "output": "-1"}
                ],
                "allowed_languages": ["Python", "JavaScript", "C++", "C", "Java"],
                "starter_code": {
                    "Python": (
                        "import sys\n\n"
                        "def max_subarray_sum():\n"
                        "    tokens = sys.stdin.read().split()\n"
                        "    if not tokens:\n"
                        "        return\n"
                        "    n = int(tokens[0])\n"
                        "    nums = [int(x) for x in tokens[1:n+1]]\n\n"
                        "    # TODO: Implement Kadane's O(N) Algorithm\n"
                        "    current_sum = nums[0]\n"
                        "    max_sum = nums[0]\n"
                        "    for num in nums[1:]:\n"
                        "        current_sum = max(num, current_sum + num)\n"
                        "        max_sum = max(max_sum, current_sum)\n"
                        "    print(max_sum)\n\n"
                        "if __name__ == '__main__':\n"
                        "    max_subarray_sum()\n"
                    ),
                    "JavaScript": (
                        "const fs = require('fs');\n\n"
                        "function solve() {\n"
                        "    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n"
                        "    if (!tokens || tokens.length < 2) return;\n"
                        "    const n = parseInt(tokens[0], 10);\n"
                        "    const nums = tokens.slice(1, n + 1).map(Number);\n\n"
                        "    let curr = nums[0], max = nums[0];\n"
                        "    for (let i = 1; i < n; i++) {\n"
                        "        curr = Math.max(nums[i], curr + nums[i]);\n"
                        "        max = Math.max(max, curr);\n"
                        "    }\n"
                        "    console.log(max);\n"
                        "}\n\n"
                        "solve();\n"
                    ),
                    "C++": (
                        "#include <iostream>\n"
                        "#include <vector>\n"
                        "#include <algorithm>\n"
                        "using namespace std;\n\n"
                        "int main() {\n"
                        "    ios_base::sync_with_stdio(false);\n"
                        "    cin.tie(NULL);\n"
                        "    int n;\n"
                        "    if (!(cin >> n)) return 0;\n"
                        "    vector<long long> nums(n);\n"
                        "    for (int i = 0; i < n; i++) cin >> nums[i];\n"
                        "    long long curr = nums[0], max_sum = nums[0];\n"
                        "    for (int i = 1; i < n; i++) {\n"
                        "        curr = max(nums[i], curr + nums[i]);\n"
                        "        max_sum = max(max_sum, curr);\n"
                        "    }\n"
                        "    cout << max_sum << \"\\n\";\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "C": (
                        "#include <stdio.h>\n"
                        "#include <stdlib.h>\n\n"
                        "int main() {\n"
                        "    int n;\n"
                        "    if (scanf(\"%d\", &n) != 1) return 0;\n"
                        "    long long *nums = (long long*)malloc(sizeof(long long) * n);\n"
                        "    for (int i = 0; i < n; i++) scanf(\"%lld\", &nums[i]);\n"
                        "    long long curr = nums[0], max_sum = nums[0];\n"
                        "    for (int i = 1; i < n; i++) {\n"
                        "        curr = (nums[i] > curr + nums[i]) ? nums[i] : curr + nums[i];\n"
                        "        if (curr > max_sum) max_sum = curr;\n"
                        "    }\n"
                        "    printf(\"%lld\\n\", max_sum);\n"
                        "    free(nums);\n"
                        "    return 0;\n"
                        "}\n"
                    ),
                    "Java": (
                        "import java.util.*;\n\n"
                        "public class Main {\n"
                        "    public static void main(String[] args) {\n"
                        "        Scanner sc = new Scanner(System.in);\n"
                        "        if (!sc.hasNextInt()) return;\n"
                        "        int n = sc.nextInt();\n"
                        "        long[] nums = new long[n];\n"
                        "        for (int i = 0; i < n; i++) nums[i] = sc.nextLong();\n"
                        "        long curr = nums[0], max = nums[0];\n"
                        "        for (int i = 1; i < n; i++) {\n"
                        "            curr = Math.max(nums[i], curr + nums[i]);\n"
                        "            max = Math.max(max, curr);\n"
                        "        }\n"
                        "        System.out.println(max);\n"
                        "    }\n"
                        "}\n"
                    )
                }
            }
        }

    # ==========================================================================
    # Attempt Lifecycle & Server-Authoritative Timer
    # ==========================================================================
    def get_or_create_attempt_session(self, attempt_id: str, user_email: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Retrieves or initializes an active exam session for the authenticated user.
        Enforces server-authoritative timer and prevents time-extension attacks.
        """
        clean_email = user_email.strip().lower()

        # Check existing in-memory session
        attempt = self._attempts.get(attempt_id)
        if not attempt:
            # Check user_service._assessment_attempts
            raw_attempts = getattr(user_service, "_assessment_attempts", {})
            if attempt_id in raw_attempts:
                raw = raw_attempts[attempt_id]
                if raw["user_email"] != clean_email:
                    return False, None, "Access denied: You do not own this examination attempt."

                asmt_id = raw.get("assessment_id", "asmt-101")
                # Find assessment details
                user_service._init_user_dashboard_data(clean_email)
                user_asmts = user_service._user_assessments.get(clean_email, [])
                asmt_meta = next((a for a in user_asmts if a["id"] == asmt_id), None)
                if not asmt_meta:
                    asmt_meta = {
                        "id": asmt_id,
                        "title": "BugBash Coding Assessment",
                        "duration_minutes": 60,
                        "rules": [
                            "Full-screen lockdown mode is recommended.",
                            "Isolated cloud runner executes your code submissions.",
                            "Do not navigate away from this tab."
                        ],
                        "allowed_languages": ["Python", "JavaScript", "C++", "C", "Java"],
                        "questions": [
                            {"order": 1, "title": "Optimized Two-Sum with Hash Map", "difficulty": "Easy", "points": 25},
                            {"order": 2, "title": "Longest Substring Without Repeating Characters", "difficulty": "Medium", "points": 35},
                            {"order": 3, "title": "Maximum Subarray Sum (Kadane's Algorithm)", "difficulty": "Medium", "points": 40}
                        ]
                    }

                duration_min = asmt_meta.get("duration_minutes", 60)
                started_dt = datetime.now(timezone.utc)
                expires_dt = started_dt + timedelta(minutes=duration_min)

                attempt = {
                    "attempt_id": attempt_id,
                    "assessment_id": asmt_id,
                    "assessment_title": asmt_meta.get("title", "BugBash Coding Assessment"),
                    "user_email": clean_email,
                    "candidate_name": user_service._users.get(clean_email, {}).get("full_name", "Candidate"),
                    "duration_minutes": duration_min,
                    "started_at": started_dt.isoformat(),
                    "expires_at": expires_dt.isoformat(),
                    "status": "In Progress",
                    "rules": asmt_meta.get("rules", []),
                    "allowed_languages": asmt_meta.get("allowed_languages", ["Python", "JavaScript", "C++", "C", "Java"]),
                    "question_ids": ["q-101", "q-102", "q-103"],
                    "question_statuses": {
                        "q-101": "Not Visited",
                        "q-102": "Not Visited",
                        "q-103": "Not Visited"
                    },
                    "drafts": {},
                    "submissions": {},
                    "proctor_events": []
                }
                self._attempts[attempt_id] = attempt
            else:
                # If attempt_id does not exist, return 404
                return False, None, f"Examination session #{attempt_id} was not found. Please start from the Assessments page."

        # Verify ownership
        if attempt["user_email"] != clean_email:
            return False, None, "Access denied: Attempt does not belong to your account."

        # Compute server-authoritative remaining time
        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(attempt["expires_at"])
        remaining_seconds = max(0, int((expires_at - now).total_seconds()))

        # Auto-expire if time has passed
        if remaining_seconds <= 0 and attempt["status"] == "In Progress":
            attempt["status"] = "Expired"
            self._finalize_attempt_score(attempt)

        payload = {
            "attempt_id": attempt["attempt_id"],
            "assessment_id": attempt["assessment_id"],
            "assessment_title": attempt["assessment_title"],
            "candidate_name": attempt["candidate_name"],
            "candidate_email": attempt["user_email"],
            "duration_minutes": attempt["duration_minutes"],
            "started_at": attempt["started_at"],
            "expires_at": attempt["expires_at"],
            "remaining_seconds": remaining_seconds,
            "status": attempt["status"],
            "total_questions": len(attempt["question_ids"]),
            "allowed_languages": attempt["allowed_languages"],
            "rules": attempt["rules"],
            "warning_threshold_seconds": 300
        }
        return True, payload, None

    def get_attempt_questions(self, attempt_id: str, user_email: str) -> Tuple[bool, Optional[List[dict]], Optional[str]]:
        """Returns the list of questions with their statuses for the left navigation panel."""
        success, attempt_meta, err = self.get_or_create_attempt_session(attempt_id, user_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        results = []
        for qid in attempt["question_ids"]:
            q_info = self._get_question_by_id(qid)
            status_val = attempt["question_statuses"].get(qid, "Not Visited")
            has_draft = qid in attempt["drafts"]
            saved_lang = attempt["drafts"].get(qid, {}).get("language")
            last_saved = attempt["drafts"].get(qid, {}).get("saved_at")

            results.append({
                "id": qid,
                "order": q_info.get("order", 1),
                "title": q_info.get("title", f"Question {qid}"),
                "difficulty": q_info.get("difficulty", "Medium"),
                "points": q_info.get("points", 25),
                "status": status_val,
                "has_draft": has_draft,
                "saved_language": saved_lang,
                "last_saved_at": last_saved
            })

        results.sort(key=lambda x: x["order"])
        return True, results, None

    def get_question_detail(self, question_id: str, attempt_id: str, user_email: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Returns problem statement, examples, constraints, and starter code for center panel.
        Updates question status from 'Not Visited' to 'Not Answered'.
        NEVER returns hidden test cases.
        """
        success, _, err = self.get_or_create_attempt_session(attempt_id, user_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        if question_id not in attempt["question_ids"]:
            return False, None, f"Question {question_id} is not part of this assessment."

        # Mark question as visited if it was 'Not Visited'
        current_status = attempt["question_statuses"].get(question_id, "Not Visited")
        if current_status == "Not Visited":
            attempt["question_statuses"][question_id] = "Not Answered"
            current_status = "Not Answered"

        q_info = self._get_question_by_id(question_id)

        # Retrieve saved draft or previous submission if any
        draft_info = attempt["drafts"].get(question_id, {})
        draft_code = draft_info.get("code")
        draft_language = draft_info.get("language")

        data = {
            "id": q_info["id"],
            "order": q_info.get("order", 1),
            "title": q_info["title"],
            "difficulty": q_info["difficulty"],
            "category": q_info.get("category", "General Coding"),
            "points": q_info["points"],
            "description": q_info["description"],
            "input_format": q_info["input_format"],
            "output_format": q_info["output_format"],
            "constraints": q_info["constraints"],
            "examples": q_info["examples"],
            "sample_test_cases": q_info["sample_test_cases"],
            "starter_code": q_info["starter_code"],
            "allowed_languages": q_info.get("allowed_languages", attempt["allowed_languages"]),
            "draft_code": draft_code,
            "draft_language": draft_language,
            "current_status": current_status
        }
        return True, data, None

    def run_code(
        self,
        attempt_id: str,
        question_id: str,
        language: str,
        code: str,
        user_email: str,
        custom_input: Optional[str] = None
    ) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Executes code against sample / visible test cases inside an isolated sandbox.
        """
        success, attempt_meta, err = self.get_or_create_attempt_session(attempt_id, user_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        if attempt["status"] != "In Progress":
            return False, None, f"Cannot run code: Assessment session is {attempt['status']}."

        q_info = self._get_question_by_id(question_id)
        if not q_info:
            return False, None, f"Question {question_id} not found."

        if not code or not code.strip():
            return False, None, "Code editor cannot be empty."

        sample_cases = q_info.get("sample_test_cases", [])
        if custom_input is not None:
            # Run custom input
            res = code_sandbox.execute(language=language, code=code, stdin_input=custom_input)
            sample_results = [{
                "test_case_index": 1,
                "input": custom_input,
                "expected_output": "(Custom Input)",
                "actual_output": res["stdout"].strip(),
                "passed": res["status"] == "success",
                "execution_time_ms": res["execution_time_ms"],
                "error": res["stderr"] if res["status"] != "success" else None
            }]
            return True, {
                "status": res["status"],
                "output": res["stdout"].strip() or res["stderr"].strip(),
                "stdout": res["stdout"],
                "stderr": res["stderr"],
                "execution_time_ms": res["execution_time_ms"],
                "memory_kb": res["memory_kb"],
                "sample_tests": sample_results,
                "passed_count": 1 if res["status"] == "success" else 0,
                "total_count": 1
            }, None

        # Run against all sample test cases
        sample_results = []
        overall_status = "success"
        first_stdout = ""
        first_stderr = ""
        total_time_ms = 0.0
        passed_cnt = 0

        for idx, tc in enumerate(sample_cases):
            res = code_sandbox.execute(language=language, code=code, stdin_input=tc["input"])
            total_time_ms += res["execution_time_ms"]
            actual = res["stdout"].strip()
            expected = tc["output"].strip()
            passed = (res["status"] == "success") and (actual == expected)

            if passed:
                passed_cnt += 1

            if res["status"] != "success" and overall_status == "success":
                overall_status = res["status"]

            if not first_stdout and res["stdout"]:
                first_stdout = res["stdout"]
            if not first_stderr and res["stderr"]:
                first_stderr = res["stderr"]

            sample_results.append({
                "test_case_index": idx + 1,
                "input": tc["input"],
                "expected_output": expected,
                "actual_output": actual,
                "passed": passed,
                "execution_time_ms": res["execution_time_ms"],
                "error": res["stderr"] if res["status"] != "success" else None
            })

            # If compilation failed, stop early
            if res["status"] == "compilation_error":
                break

        return True, {
            "status": overall_status,
            "output": first_stdout.strip() or first_stderr.strip(),
            "stdout": first_stdout,
            "stderr": first_stderr,
            "execution_time_ms": round(total_time_ms, 2),
            "memory_kb": 1280.0,
            "sample_tests": sample_results,
            "passed_count": passed_cnt,
            "total_count": len(sample_cases)
        }, None

    def submit_code(
        self,
        attempt_id: str,
        question_id: str,
        language: str,
        code: str,
        user_email: str
    ) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Official Evaluation Pipeline:
        - Runs code against both sample AND hidden test cases in sandbox
        - Evaluates output correctness
        - Calculates points earned
        - Updates question status: Answered (or Answered and Marked for Review)
        - NEVER exposes hidden test case data to client
        """
        success, attempt_meta, err = self.get_or_create_attempt_session(attempt_id, user_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        if attempt["status"] != "In Progress":
            return False, None, f"Cannot submit code: Assessment session is {attempt['status']}."

        q_info = self._get_question_by_id(question_id)
        if not q_info:
            return False, None, f"Question {question_id} not found."

        if not code or not code.strip():
            return False, None, "Cannot submit empty code."

        # Collect sample + hidden test cases
        all_cases = q_info.get("sample_test_cases", []) + q_info.get("hidden_test_cases", [])
        total_cases = len(all_cases)
        passed_cases = 0
        final_status = "Accepted"
        total_time_ms = 0.0
        feedback_msg = ""

        for tc in all_cases:
            res = code_sandbox.execute(language=language, code=code, stdin_input=tc["input"])
            total_time_ms += res["execution_time_ms"]
            actual = res["stdout"].strip()
            expected = tc["output"].strip()

            if res["status"] == "compilation_error":
                final_status = "Compilation Error"
                feedback_msg = res["stderr"]
                break
            elif res["status"] == "time_limit_exceeded":
                final_status = "Time Limit Exceeded"
                feedback_msg = "Code exceeded allowed time limit (> 3.0 seconds)."
                break
            elif res["status"] == "runtime_error":
                final_status = "Runtime Error"
                feedback_msg = res["stderr"]
                break
            elif actual == expected:
                passed_cases += 1
            else:
                if final_status == "Accepted":
                    final_status = "Wrong Answer"

        # Calculate score
        max_points = q_info.get("points", 25)
        earned_score = int(round((passed_cases / total_cases) * max_points)) if total_cases > 0 else 0

        submission_id = f"sub_{secrets.token_hex(6)}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update Question Status
        curr_status = attempt["question_statuses"].get(question_id, "Not Answered")
        if "Marked for Review" in curr_status:
            new_status = "Answered and Marked for Review"
        else:
            new_status = "Answered"
        attempt["question_statuses"][question_id] = new_status

        # Store submission
        attempt["submissions"][question_id] = {
            "submission_id": submission_id,
            "question_id": question_id,
            "language": language,
            "code": code,
            "status": final_status,
            "passed_tests": passed_cases,
            "total_tests": total_cases,
            "score": earned_score,
            "max_score": max_points,
            "submitted_at": now_iso
        }

        # Also auto-update draft
        attempt["drafts"][question_id] = {
            "code": code,
            "language": language,
            "saved_at": now_iso
        }

        if final_status == "Accepted":
            feedback_msg = f"All {total_cases} test cases passed successfully! Full score awarded."
        elif not feedback_msg:
            feedback_msg = f"Passed {passed_cases} of {total_cases} test cases."

        return True, {
            "submission_id": submission_id,
            "question_id": question_id,
            "status": final_status,
            "passed_test_cases": passed_cases,
            "total_test_cases": total_cases,
            "score": earned_score,
            "max_score": max_points,
            "execution_time_ms": round(total_time_ms, 2),
            "memory_kb": 1280.0,
            "submitted_at": now_iso,
            "feedback": feedback_msg,
            "question_status": new_status
        }, None

    def save_draft(
        self,
        attempt_id: str,
        question_id: str,
        language: str,
        code: str,
        user_email: str,
        status: Optional[str] = None
    ) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Auto-saves code draft and selected language. Validates attempt ownership.
        """
        success, attempt_meta, err = self.get_or_create_attempt_session(attempt_id, user_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        if attempt["status"] != "In Progress":
            return False, None, f"Cannot save draft: Assessment session is {attempt['status']}."

        now_iso = datetime.now(timezone.utc).isoformat()
        attempt["drafts"][question_id] = {
            "code": code,
            "language": language,
            "saved_at": now_iso
        }

        # If user explicitly changed status (e.g. marked for review)
        if status:
            attempt["question_statuses"][question_id] = status

        curr_status = attempt["question_statuses"].get(question_id, "Not Answered")
        return True, {
            "saved": True,
            "timestamp": now_iso,
            "status": curr_status,
            "message": "Draft saved successfully."
        }, None

    def final_submit_attempt(
        self,
        attempt_id: str,
        user_email: str,
        feedback: Optional[str] = None
    ) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Final Submission of Assessment:
        - Locks attempt status to 'Completed'
        - Computes cumulative score across all questions
        - Updates user assessment record and records result item
        - Prevents further code runs or modifications
        """
        clean_email = user_email.strip().lower()
        success, attempt_meta, err = self.get_or_create_attempt_session(attempt_id, clean_email)
        if not success:
            return False, None, err

        attempt = self._attempts[attempt_id]
        if attempt["status"] == "Completed":
            return False, None, "This assessment attempt has already been submitted and finalized."

        now_iso = datetime.now(timezone.utc).isoformat()
        attempt["status"] = "Completed"
        attempt["submitted_at"] = now_iso
        attempt["feedback"] = feedback

        summary = self._finalize_attempt_score(attempt)
        return True, summary, None

    def _finalize_attempt_score(self, attempt: dict) -> dict:
        """Internal helper to calculate final score and synchronize user records."""
        clean_email = attempt["user_email"]
        submissions = attempt.get("submissions", {})
        total_score = sum(sub.get("score", 0) for sub in submissions.values())
        max_score = 100

        q_summaries = []
        for qid in attempt["question_ids"]:
            q_info = self._get_question_by_id(qid)
            sub = submissions.get(qid)
            status_val = attempt["question_statuses"].get(qid, "Not Answered")
            q_summaries.append({
                "question_id": qid,
                "title": q_info.get("title", qid),
                "status": status_val,
                "score": sub.get("score", 0) if sub else 0,
                "max_score": q_info.get("points", 25),
                "evaluation_status": sub.get("status", "Not Submitted") if sub else "Not Submitted"
            })

        percentage = round((total_score / max_score) * 100, 1)

        # Update user assessment record in user_service
        user_service._init_user_dashboard_data(clean_email)
        asmts = user_service._user_assessments.get(clean_email, [])
        for a in asmts:
            if a["id"] == attempt["assessment_id"]:
                a["status"] = "Completed"
                a["score"] = total_score
                break

        # Log result in user results
        result_id = f"res_{secrets.token_hex(4)}"
        if clean_email in user_service._user_results:
            user_service._user_results[clean_email].insert(0, {
                "id": result_id,
                "assessment_id": attempt["assessment_id"],
                "assessment_title": attempt["assessment_title"],
                "score": total_score,
                "max_score": max_score,
                "percentage": percentage,
                "completion_date": datetime.now(timezone.utc).strftime("%b %d, %Y"),
                "result_status": "Distinction" if percentage >= 85 else ("Passed" if percentage >= 60 else "Needs Improvement"),
                "feedback": f"Completed proctored coding assessment with score {total_score}/{max_score}.",
                "metrics": {
                    "logic_correctness": min(100, int(percentage * 1.05)),
                    "time_complexity": 88,
                    "space_efficiency": 90,
                    "code_quality": 92,
                    "test_cases_passed": f"{sum(s.get('passed_tests', 0) for s in submissions.values())}/{sum(s.get('total_tests', 0) for s in submissions.values())}"
                }
            })

        # Log activity
        if clean_email in user_service._user_activity:
            user_service._user_activity[clean_email].insert(0, {
                "id": f"act_{secrets.token_hex(4)}",
                "type": "assessment_completed",
                "title": f"Submitted: {attempt['assessment_title']}",
                "description": f"Achieved score of {total_score}/{max_score} ({percentage}%).",
                "timestamp": "Just now",
                "score": total_score,
                "icon": "check-circle"
            })

        return {
            "completed": True,
            "attempt_id": attempt["attempt_id"],
            "submitted_at": attempt.get("submitted_at", datetime.now(timezone.utc).isoformat()),
            "total_score": total_score,
            "max_score": max_score,
            "percentage": percentage,
            "questions_summary": q_summaries,
            "message": "Assessment submitted successfully."
        }

    def log_proctor_event(self, attempt_id: str, user_email: str, event_type: str, details: Optional[str]) -> Tuple[bool, int, Optional[str]]:
        """Records telemetry integrity and proctor monitoring events."""
        clean_email = user_email.strip().lower()
        attempt = self._attempts.get(attempt_id)
        if not attempt:
            return False, 0, "Attempt not found."

        if attempt["user_email"] != clean_email:
            return False, 0, "Access denied."

        now_iso = datetime.now(timezone.utc).isoformat()
        event_entry = {
            "event_type": event_type,
            "details": details or "",
            "timestamp": now_iso
        }
        attempt["proctor_events"].append(event_entry)
        count = len(attempt["proctor_events"])
        logger.warning(f"Proctor Event on {attempt_id} ({clean_email}): {event_type} - {details} (Total: {count})")
        return True, count, None

    def _get_question_by_id(self, question_id: str) -> dict:
        """Helper to get question by ID with dynamic fallback."""
        if question_id in self._questions:
            return self._questions[question_id]

        # Dynamic fallback for unspecified question IDs
        return {
            "id": question_id,
            "order": 1,
            "title": f"Problem: {question_id.replace('-', ' ').title()}",
            "difficulty": "Medium",
            "category": "Algorithms",
            "points": 30,
            "description": f"Write an efficient algorithm to solve problem {question_id}.",
            "input_format": "Input provided on standard input (stdin).",
            "output_format": "Print result on standard output (stdout).",
            "constraints": ["1 <= N <= 10^5"],
            "examples": [{"input": "5\n1 2 3 4 5", "output": "15", "explanation": "Sum of elements"}],
            "sample_test_cases": [{"input": "5\n1 2 3 4 5", "output": "15"}],
            "hidden_test_cases": [{"input": "3\n10 20 30", "output": "60"}],
            "allowed_languages": ["Python", "JavaScript", "C++", "C", "Java"],
            "starter_code": {
                "Python": "# Write your solution here\nimport sys\n\ndef solve():\n    pass\n\nif __name__ == '__main__':\n    solve()\n",
                "JavaScript": "// Write your solution here\nconst fs = require('fs');\n",
                "C++": "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}\n",
                "C": "#include <stdio.h>\nint main() {\n    return 0;\n}\n",
                "Java": "public class Main {\n    public static void main(String[] args) {\n    }\n}\n"
            }
        }


# Global exam service instance
exam_service = ExamService()
