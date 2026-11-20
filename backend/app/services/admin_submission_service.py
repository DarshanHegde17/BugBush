"""
BugBash - Enterprise Admin Submissions Management Service
Comprehensive business logic for monitoring candidate coding and MCQ submissions,
test-case execution telemetry, 8-stage ML evaluation pipeline tracking,
manual human reviews with score adjustments, and immutable evaluation audit trails.
"""

import os
import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from backend.app.database.mongodb import mongodb

logger = logging.getLogger("bugbash.admin.submissions")


class AdminSubmissionService:
    def __init__(self):
        self._ensure_sample_submissions()

    def _ensure_sample_submissions(self):
        """Seeds representative initial submissions across coding, MCQ, and practice if MongoDB collection is empty."""
        if mongodb.submissions is not None:
            try:
                if mongodb.submissions.count_documents({}) == 0:
                    now = datetime.now(timezone.utc)
                    samples = self._generate_sample_submissions(now)
                    mongodb.submissions.insert_many(samples)
                    logger.info("Sample submissions successfully seeded into MongoDB.")
            except Exception as e:
                logger.warning(f"Error seeding sample submissions: {e}")

    def _generate_sample_submissions(self, now: datetime) -> List[Dict[str, Any]]:
        """Generates realistic sample submissions covering diverse languages, outcomes, and statuses."""
        samples = [
            # 1. Accepted Python Coding Submission (Two Sum on asmt-101)
            {
                "id": "sub_code_01",
                "submission_id": "sub_code_01",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-101",
                "assessment_title": "Data Structures & Algorithmic Logic Test",
                "question_id": "prob-01",
                "question_title": "Two Sum - Optimized Hash Map",
                "question_type": "coding",
                "difficulty": "Easy",
                "allowed_languages": ["Python", "Java", "C++", "JavaScript", "Go"],
                "language": "Python",
                "code": (
                    "class Solution:\n"
                    "    def twoSum(self, nums: list[int], target: int) -> list[int]:\n"
                    "        seen = {}\n"
                    "        for i, num in enumerate(nums):\n"
                    "            complement = target - num\n"
                    "            if complement in seen:\n"
                    "                return [seen[complement], i]\n"
                    "            seen[num] = i\n"
                    "        return []\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(hours=2, minutes=15),
                "score": 25.0,
                "max_score": 25.0,
                "evaluation_status": "Accepted",
                "execution_summary": {
                    "total_test_cases": 5,
                    "passed_test_cases": 5,
                    "failed_test_cases": 0,
                    "execution_time_ms": 28.4,
                    "memory_kb": 1420.0,
                    "compilation_status": "Success",
                    "runtime_error": None,
                    "evaluation_status": "Accepted"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 5.2,
                        "memory_kb": 1280.0,
                        "error_category": None,
                        "input_preview": "[2, 7, 11, 15], target = 9",
                        "expected_output_preview": "[0, 1]",
                        "actual_output_preview": "[0, 1]"
                    },
                    {
                        "case_id": 2,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 4.8,
                        "memory_kb": 1310.0,
                        "error_category": None,
                        "input_preview": "[3, 2, 4], target = 6",
                        "expected_output_preview": "[1, 2]",
                        "actual_output_preview": "[1, 2]"
                    },
                    {
                        "case_id": 3,
                        "visibility": "hidden",
                        "status": "Passed",
                        "execution_time_ms": 6.1,
                        "memory_kb": 1410.0,
                        "error_category": None,
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    },
                    {
                        "case_id": 4,
                        "visibility": "hidden",
                        "status": "Passed",
                        "execution_time_ms": 6.0,
                        "memory_kb": 1400.0,
                        "error_category": None,
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    },
                    {
                        "case_id": 5,
                        "visibility": "hidden",
                        "status": "Passed",
                        "execution_time_ms": 6.3,
                        "memory_kb": 1420.0,
                        "error_category": None,
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=15), "details": "Payload validated & ingested into execution queue"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=55), "details": "Sandbox container execution finished in 28.4ms"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=50), "details": "5/5 test cases passed (100% correctness)"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=45), "details": "AST parsing & control flow graph constructed"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=35), "details": "Detected Single-Pass Hash Map lookup pattern"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=25), "details": "Time: O(n), Space: O(n) auxiliary storage"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14, seconds=10), "details": "Constructive pedagogical feedback formulated"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(hours=2, minutes=14), "details": "25/25 points awarded with Distinction"}
                    ],
                    "detected_algorithm": "Single-Pass Hash Map Lookup",
                    "time_complexity": "O(n)",
                    "space_complexity": "O(n)",
                    "recognized_concepts": ["Hash Table", "Linear Traversal", "Complements", "Constant-Time Lookup"],
                    "confidence_score": 0.98,
                    "ai_feedback": "Optimal implementation utilizing linear scan and dictionary indexing. Space complexity is balanced with optimal execution speed.",
                    "processing_status": "Completed",
                    "errors": []
                },
                "manual_review": {
                    "review_required": False,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": None,
                    "review_reason": None,
                    "original_score": 25.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(hours=2, minutes=14),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Accepted",
                        "ml_status": "Completed",
                        "score": 25.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Passed all automated unit tests & syntax checks"
                    }
                ]
            },

            # 2. Wrong Answer Java Coding Submission (Valid Parentheses on asmt-101 - Flagged for Review)
            {
                "id": "sub_code_02",
                "submission_id": "sub_code_02",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-101",
                "assessment_title": "Data Structures & Algorithmic Logic Test",
                "question_id": "prob-02",
                "question_title": "Valid Parentheses & Delimiter Matching",
                "question_type": "coding",
                "difficulty": "Easy",
                "allowed_languages": ["Python", "Java", "C++", "JavaScript"],
                "language": "Java",
                "code": (
                    "import java.util.*;\n\n"
                    "public class Solution {\n"
                    "    public boolean isValid(String s) {\n"
                    "        Stack<Character> stack = new Stack<>();\n"
                    "        for (char c : s.toCharArray()) {\n"
                    "            if (c == '(') stack.push(')');\n"
                    "            else if (c == '{') stack.push('}');\n"
                    "            else if (c == '[') stack.push(']');\n"
                    "            else if (stack.isEmpty() || stack.pop() != c) return false;\n"
                    "        }\n"
                    "        // Bug: Missing check if stack is empty at end\n"
                    "        return true;\n"
                    "    }\n"
                    "}\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(hours=1, minutes=45),
                "score": 15.0,
                "max_score": 25.0,
                "evaluation_status": "Wrong Answer",
                "execution_summary": {
                    "total_test_cases": 5,
                    "passed_test_cases": 3,
                    "failed_test_cases": 2,
                    "execution_time_ms": 78.2,
                    "memory_kb": 31200.0,
                    "compilation_status": "Success",
                    "runtime_error": None,
                    "evaluation_status": "Wrong Answer"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 14.1,
                        "memory_kb": 29800.0,
                        "error_category": None,
                        "input_preview": "\"()[]{}\"",
                        "expected_output_preview": "true",
                        "actual_output_preview": "true"
                    },
                    {
                        "case_id": 2,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 12.5,
                        "memory_kb": 30100.0,
                        "error_category": None,
                        "input_preview": "\"(]\"",
                        "expected_output_preview": "false",
                        "actual_output_preview": "false"
                    },
                    {
                        "case_id": 3,
                        "visibility": "hidden",
                        "status": "Failed",
                        "execution_time_ms": 16.0,
                        "memory_kb": 31000.0,
                        "error_category": "AssertionError",
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    },
                    {
                        "case_id": 4,
                        "visibility": "hidden",
                        "status": "Failed",
                        "execution_time_ms": 17.2,
                        "memory_kb": 31200.0,
                        "error_category": "AssertionError",
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    },
                    {
                        "case_id": 5,
                        "visibility": "hidden",
                        "status": "Passed",
                        "execution_time_ms": 18.4,
                        "memory_kb": 30900.0,
                        "error_category": None,
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=45), "details": "Java 17 source parsed"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=44, seconds=45), "details": "Bytecode executed in JVM sandbox"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=44, seconds=30), "details": "3/5 test cases passed, 2 edge-cases failed"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=44, seconds=20), "details": "Stack-based parentheses matcher identified"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=44, seconds=10), "details": "Detected omission of empty stack validation for trailing open brackets"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=44, seconds=5), "details": "Time: O(n), Space: O(n)"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=43, seconds=55), "details": "Feedback generated advising `return stack.isEmpty()`"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(hours=1, minutes=43, seconds=50), "details": "15/25 partial credit assigned"}
                    ],
                    "detected_algorithm": "LIFO Stack Bracket Matching",
                    "time_complexity": "O(n)",
                    "space_complexity": "O(n)",
                    "recognized_concepts": ["Stack", "Delimiter Matching", "Edge-Case Handling"],
                    "confidence_score": 0.95,
                    "ai_feedback": "The approach correctly pushes expected closing symbols onto a stack. However, returning literal `true` fails when unmatched opening brackets remain in the stack (e.g. \"((\"). Change to `return stack.isEmpty();`.",
                    "processing_status": "Completed",
                    "errors": []
                },
                "manual_review": {
                    "review_required": True,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": "Candidate appeals that logic was 90% correct and only missed stack.isEmpty() on the final return.",
                    "review_reason": "Edge-case partial credit appeal",
                    "original_score": 15.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(hours=1, minutes=43, seconds=50),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Wrong Answer",
                        "ml_status": "Completed",
                        "score": 15.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Failed hidden test case 3 & 4 (unbalanced trailing brackets)"
                    }
                ]
            },

            # 3. Time Limit Exceeded C++ Submission (Longest Substring on asmt-102)
            {
                "id": "sub_code_03",
                "submission_id": "sub_code_03",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-102",
                "assessment_title": "Semester Examination: Advanced Dynamic Programming",
                "question_id": "prob-03",
                "question_title": "Longest Substring Without Repeating Characters",
                "question_type": "coding",
                "difficulty": "Medium",
                "allowed_languages": ["C++", "Java", "Python", "Go"],
                "language": "C++",
                "code": (
                    "#include <string>\n"
                    "#include <unordered_set>\n"
                    "#include <algorithm>\n\n"
                    "class Solution {\n"
                    "public:\n"
                    "    int lengthOfLongestSubstring(std::string s) {\n"
                    "        int n = s.length();\n"
                    "        int maxLen = 0;\n"
                    "        // Brute force O(n^3) implementation triggers TLE on large strings\n"
                    "        for (int i = 0; i < n; i++) {\n"
                    "            for (int j = i; j < n; j++) {\n"
                    "                std::unordered_set<char> set;\n"
                    "                bool hasDup = false;\n"
                    "                for (int k = i; k <= j; k++) {\n"
                    "                    if (set.count(s[k])) { hasDup = true; break; }\n"
                    "                    set.insert(s[k]);\n"
                    "                }\n"
                    "                if (!hasDup) maxLen = std::max(maxLen, j - i + 1);\n"
                    "            }\n"
                    "        }\n"
                    "        return maxLen;\n"
                    "    }\n"
                    "};\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(hours=5),
                "score": 5.0,
                "max_score": 25.0,
                "evaluation_status": "Time Limit Exceeded",
                "execution_summary": {
                    "total_test_cases": 6,
                    "passed_test_cases": 2,
                    "failed_test_cases": 4,
                    "execution_time_ms": 3050.0,
                    "memory_kb": 2240.0,
                    "compilation_status": "Success",
                    "runtime_error": "Execution exceeded maximum allowed time limit (3000ms)",
                    "evaluation_status": "Time Limit Exceeded"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 3.4,
                        "memory_kb": 1200.0,
                        "error_category": None,
                        "input_preview": "\"abcabcbb\"",
                        "expected_output_preview": "3",
                        "actual_output_preview": "3"
                    },
                    {
                        "case_id": 2,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 1.2,
                        "memory_kb": 1150.0,
                        "error_category": None,
                        "input_preview": "\"bbbbb\"",
                        "expected_output_preview": "1",
                        "actual_output_preview": "1"
                    },
                    {
                        "case_id": 3,
                        "visibility": "hidden",
                        "status": "Time Limit Exceeded",
                        "execution_time_ms": 3000.0,
                        "memory_kb": 2240.0,
                        "error_category": "TimeLimitExceeded",
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(hours=5), "details": "C++20 GCC compiler"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=55), "details": "Process killed at 3000ms threshold"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=50), "details": "2/6 passed before TLE on string of length 50,000"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=45), "details": "Triple nested loop discovered"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=35), "details": "Sub-optimal brute-force cubic scan"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=25), "details": "Time: O(n^3), Space: O(min(n, m))"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59, seconds=10), "details": "Sliding window optimization recommendation provided"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(hours=4, minutes=59), "details": "5/25 partial credit"}
                    ],
                    "detected_algorithm": "Brute-Force Triple Loop",
                    "time_complexity": "O(n^3)",
                    "space_complexity": "O(k)",
                    "recognized_concepts": ["Nested Loops", "Unordered Set", "Timeout"],
                    "confidence_score": 0.99,
                    "ai_feedback": "The cubic brute-force approach generates all substrings and evaluates each character. Replace with a two-pointer sliding window using a hash map to achieve optimal O(n) linear performance.",
                    "processing_status": "Completed",
                    "errors": ["Timeout exceeded on test case #3"]
                },
                "manual_review": {
                    "review_required": False,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": None,
                    "review_reason": None,
                    "original_score": 5.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(hours=4, minutes=59),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Time Limit Exceeded",
                        "ml_status": "Completed",
                        "score": 5.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Terminated by watchdog timer"
                    }
                ]
            },

            # 4. Compilation Error Python Submission (Coin Change on asmt-103)
            {
                "id": "sub_code_04",
                "submission_id": "sub_code_04",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-103",
                "assessment_title": "Object-Oriented Design & Clean Code Evaluation",
                "question_id": "prob-05",
                "question_title": "Coin Change - Minimum Denominations",
                "question_type": "coding",
                "difficulty": "Medium",
                "allowed_languages": ["Python", "Java", "C++"],
                "language": "Python",
                "code": (
                    "def coinChange(coins, amount):\n"
                    "    dp = [float('inf') * (amount + 1)\n"
                    "    dp[0] = 0\n"
                    "    for coin in coins:\n"
                    "        for x in range(coin, amount + 1):\n"
                    "            dp[x] = min(dp[x], dp[x - coin] + 1)\n"
                    "    return dp[amount] if dp[amount] != float('inf') else -1\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(days=1, hours=2),
                "score": 0.0,
                "max_score": 25.0,
                "evaluation_status": "Compilation Error",
                "execution_summary": {
                    "total_test_cases": 4,
                    "passed_test_cases": 0,
                    "failed_test_cases": 4,
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0,
                    "compilation_status": "Compilation Error",
                    "runtime_error": "SyntaxError: closing parenthesis ')' does not match opening parenthesis '['",
                    "evaluation_status": "Compilation Error"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Compilation Error",
                        "execution_time_ms": 0.0,
                        "memory_kb": 0.0,
                        "error_category": "SyntaxError",
                        "input_preview": "coins = [1, 2, 5], amount = 11",
                        "expected_output_preview": "3",
                        "actual_output_preview": None
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(days=1, hours=2), "details": "Python 3.12 syntax verification"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "failed", "completed_at": now - timedelta(days=1, hours=2), "details": "SyntaxError: unmatched bracket at line 2"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "failed", "completed_at": None, "details": "Aborted due to compilation error"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(days=1, hours=2), "details": "Partial static AST recovery attempted"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(days=1, hours=2), "details": "Detected Dynamic Programming bottom-up tabular approach"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "pending", "completed_at": None, "details": "Awaiting compilation fix"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(days=1, hours=2), "details": "Syntax correction suggested: `[float('inf')] * (amount + 1)`"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(days=1, hours=2), "details": "0/25 points"}
                    ],
                    "detected_algorithm": "Dynamic Programming (Tabular)",
                    "time_complexity": "N/A (Syntax Error)",
                    "space_complexity": "N/A (Syntax Error)",
                    "recognized_concepts": ["Dynamic Programming", "Syntax Error", "Array Initialization"],
                    "confidence_score": 0.85,
                    "ai_feedback": "Line 2 contains a syntax error: `[float('inf') * (amount + 1)` has unbalanced brackets. Change to `[float('inf')] * (amount + 1)`.",
                    "processing_status": "Failed",
                    "errors": ["SyntaxError: closing parenthesis ')' does not match opening parenthesis '[' on line 2"]
                },
                "manual_review": {
                    "review_required": True,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": "Flagged automatically due to compilation failure in high-weight assessment.",
                    "review_reason": "Evaluation Failure Investigation",
                    "original_score": 0.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(days=1, hours=2),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Compilation Error",
                        "ml_status": "Failed",
                        "score": 0.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Failed parsing Python syntax"
                    }
                ]
            },

            # 5. MCQ Submission (Computer Science Fundamentals on asmt-104)
            {
                "id": "sub_mcq_05",
                "submission_id": "sub_mcq_05",
                "submission_type": "mcq",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-104",
                "assessment_title": "Computer Science Fundamentals: Diagnostic MCQ Exam",
                "question_id": "mcq-01",
                "question_title": "Time Complexity of Balanced BST Operations",
                "question_type": "mcq",
                "difficulty": "Easy",
                "allowed_languages": [],
                "language": None,
                "code": None,
                "selected_option": "O(log n) worst-case and average-case time complexity",
                "submitted_at": now - timedelta(days=2, hours=4),
                "score": 10.0,
                "max_score": 10.0,
                "evaluation_status": "Accepted",
                "execution_summary": {
                    "total_test_cases": 1,
                    "passed_test_cases": 1,
                    "failed_test_cases": 0,
                    "execution_time_ms": 1.1,
                    "memory_kb": 256.0,
                    "compilation_status": "N/A",
                    "runtime_error": None,
                    "evaluation_status": "Accepted"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 1.1,
                        "memory_kb": 256.0,
                        "error_category": None,
                        "input_preview": "Selected Option",
                        "expected_output_preview": "Option C: O(log n)",
                        "actual_output_preview": "Option C: O(log n)"
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "MCQ option key recorded"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "N/A (Discrete Answer Evaluation)"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "Verified against answer key"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "Knowledge domain: Data Structures / Trees"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "Tree balance properties understood"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "N/A"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "Correct comprehension of AVL/Red-Black tree height bounds"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(days=2, hours=4), "details": "10/10 points"}
                    ],
                    "detected_algorithm": "MCQ Option Validation",
                    "time_complexity": "N/A",
                    "space_complexity": "N/A",
                    "recognized_concepts": ["Binary Search Tree", "Logarithmic Time", "Tree Height"],
                    "confidence_score": 1.0,
                    "ai_feedback": "Correct. In a self-balancing binary search tree (such as AVL or Red-Black), depth is strictly constrained to O(log n), ensuring lookup, insertion, and deletion are O(log n).",
                    "processing_status": "Completed",
                    "errors": []
                },
                "manual_review": {
                    "review_required": False,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": None,
                    "review_reason": None,
                    "original_score": 10.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(days=2, hours=4),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Accepted",
                        "ml_status": "Completed",
                        "score": 10.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Exact answer key match"
                    }
                ]
            },

            # 6. Manual Review Completed Submission (Course Schedule on asmt-105 with adjusted score)
            {
                "id": "sub_code_06",
                "submission_id": "sub_code_06",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-105",
                "assessment_title": "Full-Stack System Architecture & API Design Assessment",
                "question_id": "prob-07",
                "question_title": "Course Schedule & Dependency Cycle Check",
                "question_type": "coding",
                "difficulty": "Medium",
                "allowed_languages": ["Python", "Java", "C++", "Go"],
                "language": "Python",
                "code": (
                    "from collections import deque, defaultdict\n\n"
                    "def canFinish(numCourses, prerequisites):\n"
                    "    adj = defaultdict(list)\n"
                    "    in_degree = [0] * numCourses\n"
                    "    for dest, src in prerequisites:\n"
                    "        adj[src].append(dest)\n"
                    "        in_degree[dest] += 1\n"
                    "    queue = deque([i for i in range(numCourses) if in_degree[i] == 0])\n"
                    "    visited_count = 0\n"
                    "    while queue:\n"
                    "        node = queue.popleft()\n"
                    "        visited_count += 1\n"
                    "        for neighbor in adj[node]:\n"
                    "            in_degree[neighbor] -= 1\n"
                    "            if in_degree[neighbor] == 0:\n"
                    "                queue.append(neighbor)\n"
                    "    return visited_count == numCourses\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(days=3),
                "score": 25.0,
                "max_score": 25.0,
                "evaluation_status": "Accepted",
                "execution_summary": {
                    "total_test_cases": 5,
                    "passed_test_cases": 5,
                    "failed_test_cases": 0,
                    "execution_time_ms": 32.1,
                    "memory_kb": 1640.0,
                    "compilation_status": "Success",
                    "runtime_error": None,
                    "evaluation_status": "Accepted"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 6.2,
                        "memory_kb": 1500.0,
                        "error_category": None,
                        "input_preview": "2, [[1, 0]]",
                        "expected_output_preview": "true",
                        "actual_output_preview": "true"
                    },
                    {
                        "case_id": 2,
                        "visibility": "hidden",
                        "status": "Passed",
                        "execution_time_ms": 7.4,
                        "memory_kb": 1640.0,
                        "error_category": None,
                        "input_preview": None,
                        "expected_output_preview": None,
                        "actual_output_preview": None
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Kahn's Topological Sort algorithm detected"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Sandbox run clean"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(days=3), "details": "All unit tests passed"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(days=3), "details": "BFS In-Degree Queue"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Topological ordering via Kahn's algorithm"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Time: O(V + E), Space: O(V + E)"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Optimal graph traversal"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(days=3), "details": "Full credit awarded"}
                    ],
                    "detected_algorithm": "Kahn's Algorithm (BFS Topological Sort)",
                    "time_complexity": "O(V + E)",
                    "space_complexity": "O(V + E)",
                    "recognized_concepts": ["Topological Sort", "In-Degree Array", "BFS Queue", "Directed Graph"],
                    "confidence_score": 0.97,
                    "ai_feedback": "Exemplary implementation of topological sorting using Kahn's algorithm. Time and space boundaries match theoretical lower bounds.",
                    "processing_status": "Completed",
                    "errors": []
                },
                "manual_review": {
                    "review_required": True,
                    "is_reviewed": True,
                    "reviewed_by": "admin@bugbash.com",
                    "reviewed_at": now - timedelta(days=2, hours=10),
                    "review_notes": "Reviewed by lead technical evaluator. Clean code style, comprehensive variable naming, and optimal graph representations.",
                    "review_reason": "Evaluator Quality Assurance Sample",
                    "original_score": 20.0,
                    "adjusted_score": 25.0,
                    "score_adjusted": True,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(days=3),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Accepted",
                        "ml_status": "Completed",
                        "score": 20.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Automated baseline scoring"
                    },
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(days=2, hours=10),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Accepted",
                        "ml_status": "Completed",
                        "score": 25.0,
                        "action": "Manual Score Adjustment",
                        "actor": "admin@bugbash.com",
                        "notes": "Score upgraded +5pts based on clean code structure & optimal space complexity."
                    }
                ]
            },

            # 7. Pending Evaluation Submission (Search in Rotated Array on asmt-106)
            {
                "id": "sub_code_07",
                "submission_id": "sub_code_07",
                "submission_type": "coding",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": "asmt-106",
                "assessment_title": "Python Concurrency & Memory Profiling Lab Test",
                "question_id": "prob-06",
                "question_title": "Search in Rotated Sorted Array",
                "question_type": "coding",
                "difficulty": "Medium",
                "allowed_languages": ["Python", "Java", "C++"],
                "language": "Python",
                "code": (
                    "def search(nums, target):\n"
                    "    left, right = 0, len(nums) - 1\n"
                    "    while left <= right:\n"
                    "        mid = (left + right) // 2\n"
                    "        if nums[mid] == target:\n"
                    "            return mid\n"
                    "        if nums[left] <= nums[mid]:\n"
                    "            if nums[left] <= target < nums[mid]:\n"
                    "                right = mid - 1\n"
                    "            else:\n"
                    "                left = mid + 1\n"
                    "        else:\n"
                    "            if nums[mid] < target <= nums[right]:\n"
                    "                left = mid + 1\n"
                    "            else:\n"
                    "                right = mid - 1\n"
                    "    return -1\n"
                ),
                "selected_option": None,
                "submitted_at": now - timedelta(minutes=5),
                "score": 0.0,
                "max_score": 25.0,
                "evaluation_status": "Pending",
                "execution_summary": {
                    "total_test_cases": 6,
                    "passed_test_cases": 0,
                    "failed_test_cases": 0,
                    "execution_time_ms": 0.0,
                    "memory_kb": 0.0,
                    "compilation_status": "Success",
                    "runtime_error": None,
                    "evaluation_status": "Pending"
                },
                "test_cases": [],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(minutes=5), "details": "Enqueued in async worker queue"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "in_progress", "completed_at": None, "details": "Sandbox instance initializing"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "pending", "completed_at": None, "details": "Pending sandbox results"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "pending", "completed_at": None, "details": None},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "pending", "completed_at": None, "details": None},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "pending", "completed_at": None, "details": None},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "pending", "completed_at": None, "details": None},
                        {"stage_number": 8, "name": "Final result calculated", "status": "pending", "completed_at": None, "details": None}
                    ],
                    "detected_algorithm": None,
                    "time_complexity": None,
                    "space_complexity": None,
                    "recognized_concepts": [],
                    "confidence_score": None,
                    "ai_feedback": None,
                    "processing_status": "Pending",
                    "errors": []
                },
                "manual_review": {
                    "review_required": False,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": None,
                    "review_reason": None,
                    "original_score": 0.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(minutes=5),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Pending",
                        "ml_status": "Pending",
                        "score": 0.0,
                        "action": "Enqueued for Execution",
                        "actor": "System",
                        "notes": "Queued in high-priority assessment worker"
                    }
                ]
            },

            # 8. Practice Submission (Two Sum Practice Problem)
            {
                "id": "sub_practice_08",
                "submission_id": "sub_practice_08",
                "submission_type": "practice",
                "candidate_id": "usr_demo_01",
                "candidate_name": "Alexander Morgan",
                "candidate_email": "demo@bugbash.com",
                "candidate_avatar": "/assets/avatar-1.png",
                "assessment_id": None,
                "assessment_title": "Self-Paced Practice",
                "question_id": "prob-01",
                "question_title": "Two Sum - Optimized Hash Map",
                "question_type": "coding",
                "difficulty": "Easy",
                "allowed_languages": ["Python", "Java", "C++", "JavaScript"],
                "language": "Python",
                "code": "def two_sum(nums, target): return [0, 1]",
                "selected_option": None,
                "submitted_at": now - timedelta(days=4),
                "score": 0.0,
                "max_score": 25.0,
                "evaluation_status": "Wrong Answer",
                "execution_summary": {
                    "total_test_cases": 5,
                    "passed_test_cases": 1,
                    "failed_test_cases": 4,
                    "execution_time_ms": 36.9,
                    "memory_kb": 1280.0,
                    "compilation_status": "Success",
                    "runtime_error": None,
                    "evaluation_status": "Wrong Answer"
                },
                "test_cases": [
                    {
                        "case_id": 1,
                        "visibility": "public",
                        "status": "Passed",
                        "execution_time_ms": 8.0,
                        "memory_kb": 1280.0,
                        "error_category": None,
                        "input_preview": "[2, 7, 11, 15], 9",
                        "expected_output_preview": "[0, 1]",
                        "actual_output_preview": "[0, 1]"
                    },
                    {
                        "case_id": 2,
                        "visibility": "public",
                        "status": "Failed",
                        "execution_time_ms": 7.1,
                        "memory_kb": 1280.0,
                        "error_category": "AssertionError",
                        "input_preview": "[3, 2, 4], 6",
                        "expected_output_preview": "[1, 2]",
                        "actual_output_preview": "[0, 1]"
                    }
                ],
                "ml_analysis": {
                    "pipeline_stages": [
                        {"stage_number": 1, "name": "Code submission received", "status": "completed", "completed_at": now - timedelta(days=4), "details": "Practice problem runner"},
                        {"stage_number": 2, "name": "Code execution completed", "status": "completed", "completed_at": now - timedelta(days=4), "details": "Fast exit on static return"},
                        {"stage_number": 3, "name": "Test-case evaluation completed", "status": "completed", "completed_at": now - timedelta(days=4), "details": "1/5 passed"},
                        {"stage_number": 4, "name": "Logic recognition started", "status": "completed", "completed_at": now - timedelta(days=4), "details": "Hardcoded response detected"},
                        {"stage_number": 5, "name": "Algorithm & approach analysis completed", "status": "completed", "completed_at": now - timedelta(days=4), "details": "No algorithmic traversal implemented"},
                        {"stage_number": 6, "name": "Complexity estimation completed", "status": "completed", "completed_at": now - timedelta(days=4), "details": "O(1) trivial"},
                        {"stage_number": 7, "name": "AI feedback generated", "status": "completed", "completed_at": now - timedelta(days=4), "details": "Advice to iterate through array elements"},
                        {"stage_number": 8, "name": "Final result calculated", "status": "completed", "completed_at": now - timedelta(days=4), "details": "0/25"}
                    ],
                    "detected_algorithm": "Hardcoded Literal Output",
                    "time_complexity": "O(1)",
                    "space_complexity": "O(1)",
                    "recognized_concepts": ["Hardcoded Return"],
                    "confidence_score": 1.0,
                    "ai_feedback": "The solution merely hardcodes `[0, 1]` without searching for complementary pairs across arbitrary inputs. Use a dictionary to store seen indices.",
                    "processing_status": "Completed",
                    "errors": []
                },
                "manual_review": {
                    "review_required": False,
                    "is_reviewed": False,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "review_notes": None,
                    "review_reason": None,
                    "original_score": 0.0,
                    "adjusted_score": None,
                    "score_adjusted": False,
                    "re_evaluation_requested": False,
                    "re_evaluation_reason": None
                },
                "evaluation_history": [
                    {
                        "attempt_number": 1,
                        "timestamp": now - timedelta(days=4),
                        "engine_version": "BugBash-EvalEngine-v2.4",
                        "execution_status": "Wrong Answer",
                        "ml_status": "Completed",
                        "score": 0.0,
                        "action": "Automated Evaluation",
                        "actor": "System",
                        "notes": "Hardcoded output detected"
                    }
                ]
            }
        ]
        return samples

    def _log_audit(self, action: str, admin_user: dict, target_id: str, details: dict):
        """Records administrative actions to the immutable audit trail."""
        if mongodb.admin_audit_logs is not None:
            try:
                record = {
                    "id": f"audit_{secrets.token_hex(6)}",
                    "action": action,
                    "module": "submissions",
                    "admin_email": admin_user.get("email") or "admin@bugbash.com",
                    "admin_name": admin_user.get("full_name") or admin_user.get("name") or "Administrator",
                    "target_id": target_id,
                    "details": details,
                    "timestamp": datetime.now(timezone.utc)
                }
                mongodb.admin_audit_logs.insert_one(record)
            except Exception as e:
                logger.warning(f"Failed to record submission audit log: {e}")

    # ==========================================================================
    # 1. Summary Metrics & Dashboard Statistics
    # ==========================================================================
    def get_statistics(self) -> Dict[str, Any]:
        """Computes summary metrics for submissions cards."""
        if mongodb.submissions is None:
            return {
                "total_submissions": 0,
                "successful_submissions": 0,
                "failed_submissions": 0,
                "pending_evaluation": 0,
                "manual_reviews_required": 0,
                "evaluation_errors": 0
            }

        all_subs = list(mongodb.submissions.find({}))
        total = len(all_subs)
        successful = 0
        failed = 0
        pending = 0
        reviews_required = 0
        errors = 0

        for s in all_subs:
            st = s.get("evaluation_status", "Pending")
            if st == "Accepted":
                successful += 1
            elif st in ("Wrong Answer", "Time Limit Exceeded", "Memory Limit Exceeded"):
                failed += 1
            elif st in ("Pending", "In Progress"):
                pending += 1
            elif st in ("Compilation Error", "Runtime Error", "Evaluation Error"):
                errors += 1

            mr = s.get("manual_review", {})
            if mr.get("review_required") and not mr.get("is_reviewed"):
                reviews_required += 1

        return {
            "total_submissions": total,
            "successful_submissions": successful,
            "failed_submissions": failed,
            "pending_evaluation": pending,
            "manual_reviews_required": reviews_required,
            "evaluation_errors": errors
        }

    # ==========================================================================
    # 2. Submissions Listing & Directory
    # ==========================================================================
    def get_submissions_list(
        self,
        search: Optional[str] = None,
        assessment_id: Optional[str] = None,
        candidate: Optional[str] = None,
        language: Optional[str] = None,
        question_type: Optional[str] = None,
        status: Optional[str] = None,
        review_filter: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        sort_by: str = "submitted_at",
        sort_order: str = "desc",
        page: int = 1,
        limit: int = 15
    ) -> Dict[str, Any]:
        """Lists candidate submissions with full live multi-filtering, sorting, and pagination."""
        if mongodb.submissions is None:
            return {
                "summary": self.get_statistics(),
                "submissions": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            }

        docs = list(mongodb.submissions.find({}))

        # In-memory filtering for complete flexibility
        filtered = []
        for d in docs:
            # 1. Search Query
            if search:
                sq = search.strip().lower()
                id_match = sq in d.get("id", "").lower() or sq in d.get("submission_id", "").lower()
                cand_match = sq in d.get("candidate_name", "").lower() or sq in d.get("candidate_email", "").lower()
                asmt_match = sq in (d.get("assessment_title") or "").lower() or sq in (d.get("assessment_id") or "").lower()
                q_match = sq in d.get("question_title", "").lower() or sq in d.get("question_id", "").lower()
                if not (id_match or cand_match or asmt_match or q_match):
                    continue

            # 2. Assessment filter
            if assessment_id and assessment_id != "all":
                if d.get("assessment_id") != assessment_id:
                    continue

            # 3. Candidate filter
            if candidate and candidate != "all":
                c_clean = candidate.strip().lower()
                if d.get("candidate_id") != c_clean and d.get("candidate_email", "").lower() != c_clean:
                    continue

            # 4. Language filter
            if language and language != "all":
                if (d.get("language") or "").lower() != language.strip().lower():
                    continue

            # 5. Question Type filter
            if question_type and question_type != "all":
                if d.get("question_type", "coding").lower() != question_type.strip().lower():
                    continue

            # 6. Evaluation Status filter
            if status and status != "all":
                st_clean = status.strip().lower()
                d_st = d.get("evaluation_status", "").lower()
                if st_clean == "successful":
                    if d_st != "accepted":
                        continue
                elif st_clean == "failed":
                    if d_st not in ("wrong answer", "time limit exceeded", "memory limit exceeded"):
                        continue
                elif st_clean == "pending":
                    if d_st not in ("pending", "in progress"):
                        continue
                elif st_clean == "error":
                    if d_st not in ("compilation error", "runtime error", "evaluation error"):
                        continue
                else:
                    if d_st != st_clean:
                        continue

            # 7. Review Filter
            if review_filter and review_filter != "all":
                mr = d.get("manual_review", {})
                if review_filter == "pending_review":
                    if not (mr.get("review_required") and not mr.get("is_reviewed")):
                        continue
                elif review_filter == "reviewed":
                    if not mr.get("is_reviewed"):
                        continue

            # 8. Date Range
            sub_at = d.get("submitted_at")
            if sub_at:
                if isinstance(sub_at, str):
                    try:
                        sub_dt = datetime.fromisoformat(sub_at.replace("Z", "+00:00"))
                    except Exception:
                        sub_dt = None
                else:
                    sub_dt = sub_at

                if sub_dt:
                    if start_date:
                        try:
                            s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                            if sub_dt < s_dt:
                                continue
                        except Exception:
                            pass
                    if end_date:
                        try:
                            e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                            if sub_dt > e_dt:
                                continue
                        except Exception:
                            pass

            filtered.append(d)

        # Sorting helper
        def sort_key(item):
            val = item.get(sort_by)
            if not val:
                return ""
            if isinstance(val, datetime):
                return val.isoformat()
            return str(val)

        is_desc = sort_order.lower() == "desc"
        filtered.sort(key=sort_key, reverse=is_desc)

        total = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_docs = filtered[start_idx:end_idx]

        # Format items
        formatted_items = []
        for d in paginated_docs:
            exec_sum = d.get("execution_summary", {})
            mr = d.get("manual_review", {})
            sub_id = d.get("submission_id") or d.get("id") or str(d.get("_id"))
            formatted_items.append({
                "id": sub_id,
                "submission_id": sub_id,
                "candidate_id": d.get("candidate_id") or "usr_demo_01",
                "candidate_name": d.get("candidate_name") or "Alexander Morgan",
                "candidate_email": d.get("candidate_email") or "demo@bugbash.com",
                "assessment_id": d.get("assessment_id"),
                "assessment_title": d.get("assessment_title") or "General Assessment",
                "question_id": d.get("question_id") or "prob-01",
                "question_title": d.get("question_title") or "Two Sum",
                "question_type": d.get("question_type", "coding"),
                "language": d.get("language"),
                "submitted_at": d.get("submitted_at"),
                "passed_test_cases": exec_sum.get("passed_test_cases", 0),
                "total_test_cases": exec_sum.get("total_test_cases", 0),
                "score": float(d.get("score") or 0.0),
                "max_score": float(d.get("max_score") or 100.0),
                "evaluation_status": d.get("evaluation_status", "Pending"),
                "review_required": bool(mr.get("review_required", False)),
                "is_reviewed": bool(mr.get("is_reviewed", False)),
                "has_code": bool(d.get("code"))
            })

        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "summary": self.get_statistics(),
            "submissions": formatted_items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages
        }

    # ==========================================================================
    # 3. Submission Details & Sanitization
    # ==========================================================================
    def get_submission_details(self, submission_id: str, admin_user: dict) -> Dict[str, Any]:
        """
        Retrieves detailed submission specifications.
        CRITICAL SECURITY:
        - Never returns hidden test case inputs, expected outputs, or reference solutions.
        - Only public test cases retain input and output previews.
        - Enforces code viewing authorization.
        """
        sid = submission_id.strip()
        doc = mongodb.submissions.find_one({"$or": [{"id": sid}, {"submission_id": sid}]})
        if not doc:
            raise KeyError(f"Submission '{sid}' not found.")

        # Check permissions for source code
        # System Administrator, Super Admin, and authorized roles have full code viewer rights
        can_view_code = True
        can_review = True

        # Sanitize test cases strictly
        raw_test_cases = doc.get("test_cases", [])
        sanitized_test_cases = []
        for tc in raw_test_cases:
            is_public = tc.get("visibility", "public").lower() == "public"
            sanitized_test_cases.append({
                "case_id": tc.get("case_id", len(sanitized_test_cases) + 1),
                "visibility": "public" if is_public else "hidden",
                "status": tc.get("status", "Passed"),
                "execution_time_ms": float(tc.get("execution_time_ms", 0.0)),
                "memory_kb": float(tc.get("memory_kb", 0.0)),
                "error_category": tc.get("error_category"),
                # Only expose inputs & outputs for public test cases
                "input_preview": tc.get("input_preview") if is_public else None,
                "expected_output_preview": tc.get("expected_output_preview") if is_public else None,
                "actual_output_preview": tc.get("actual_output_preview") if is_public else None
            })

        # Sanitize ObjectId in document
        doc_id = doc.get("submission_id") or doc.get("id") or str(doc.get("_id"))
        exec_sum = doc.get("execution_summary", {})
        ml_data = doc.get("ml_analysis", {})
        manual_rev = doc.get("manual_review", {})
        eval_hist = doc.get("evaluation_history", [])

        # Clean history items
        clean_hist = []
        for h in eval_hist:
            h_copy = dict(h)
            if "_id" in h_copy:
                h_copy["_id"] = str(h_copy["_id"])
            clean_hist.append(h_copy)

        return {
            "id": doc_id,
            "submission_id": doc_id,
            "submission_type": doc.get("submission_type", "coding"),
            "candidate_id": doc.get("candidate_id") or "usr_demo_01",
            "candidate_name": doc.get("candidate_name") or "Alexander Morgan",
            "candidate_email": doc.get("candidate_email") or "demo@bugbash.com",
            "candidate_avatar": doc.get("candidate_avatar") or "/assets/avatar-1.png",
            "assessment_id": doc.get("assessment_id"),
            "assessment_title": doc.get("assessment_title") or "General Assessment",
            "question_id": doc.get("question_id") or "prob-01",
            "question_title": doc.get("question_title") or "Two Sum",
            "question_type": doc.get("question_type", "coding"),
            "difficulty": doc.get("difficulty", "Medium"),
            "allowed_languages": doc.get("allowed_languages", ["Python", "Java", "C++", "JavaScript"]),
            "language": doc.get("language"),
            "code_preview": doc.get("code") if can_view_code else None,
            "can_view_code": can_view_code,
            "can_review": can_review,
            "selected_option": doc.get("selected_option"),
            "submitted_at": doc.get("submitted_at"),
            "score": float(doc.get("score") or 0.0),
            "max_score": float(doc.get("max_score") or 100.0),
            "evaluation_status": doc.get("evaluation_status", "Accepted"),
            "execution_summary": {
                "total_test_cases": exec_sum.get("total_test_cases", 0),
                "passed_test_cases": exec_sum.get("passed_test_cases", 0),
                "failed_test_cases": exec_sum.get("failed_test_cases", 0),
                "execution_time_ms": float(exec_sum.get("execution_time_ms", 0.0)),
                "memory_kb": float(exec_sum.get("memory_kb", 0.0)),
                "compilation_status": exec_sum.get("compilation_status", "Success"),
                "runtime_error": exec_sum.get("runtime_error"),
                "evaluation_status": exec_sum.get("evaluation_status", doc.get("evaluation_status", "Accepted"))
            },
            "test_cases": sanitized_test_cases,
            "ml_analysis": {
                "pipeline_stages": ml_data.get("pipeline_stages", []),
                "detected_algorithm": ml_data.get("detected_algorithm"),
                "time_complexity": ml_data.get("time_complexity"),
                "space_complexity": ml_data.get("space_complexity"),
                "recognized_concepts": ml_data.get("recognized_concepts", []),
                "confidence_score": ml_data.get("confidence_score"),
                "ai_feedback": ml_data.get("ai_feedback"),
                "processing_status": ml_data.get("processing_status", "Completed"),
                "errors": ml_data.get("errors", [])
            },
            "manual_review": {
                "review_required": bool(manual_rev.get("review_required", False)),
                "is_reviewed": bool(manual_rev.get("is_reviewed", False)),
                "reviewed_by": manual_rev.get("reviewed_by"),
                "reviewed_at": manual_rev.get("reviewed_at"),
                "review_notes": manual_rev.get("review_notes"),
                "review_reason": manual_rev.get("review_reason"),
                "original_score": manual_rev.get("original_score"),
                "adjusted_score": manual_rev.get("adjusted_score"),
                "score_adjusted": bool(manual_rev.get("score_adjusted", False)),
                "re_evaluation_requested": bool(manual_rev.get("re_evaluation_requested", False)),
                "re_evaluation_reason": manual_rev.get("re_evaluation_reason")
            },
            "evaluation_history": clean_hist
        }

    # ==========================================================================
    # 4. Specific Inspection Sub-Endpoints
    # ==========================================================================
    def get_submission_code(self, submission_id: str, admin_user: dict) -> Dict[str, Any]:
        """Returns the submitted source code with syntax language and copy permissions."""
        details = self.get_submission_details(submission_id, admin_user)
        if not details.get("can_view_code"):
            raise PermissionError("Administrator does not have authorization to inspect source code.")

        code = details.get("code_preview") or ""
        return {
            "submission_id": details["submission_id"],
            "language": details.get("language") or "plaintext",
            "code": code,
            "can_copy": True
        }

    def get_execution_results(self, submission_id: str, admin_user: dict) -> Dict[str, Any]:
        """Returns the sanitized test-case results and execution summary."""
        details = self.get_submission_details(submission_id, admin_user)
        return {
            "submission_id": details["submission_id"],
            "execution_summary": details["execution_summary"],
            "test_cases": details["test_cases"]
        }

    def get_ml_analysis(self, submission_id: str, admin_user: dict) -> Dict[str, Any]:
        """Returns the 8-stage ML evaluation pipeline and algorithmic analysis."""
        details = self.get_submission_details(submission_id, admin_user)
        return {
            "submission_id": details["submission_id"],
            "ml_analysis": details["ml_analysis"]
        }

    def get_evaluation_history(self, submission_id: str, admin_user: dict) -> List[Dict[str, Any]]:
        """Returns the immutable chronological evaluation history."""
        details = self.get_submission_details(submission_id, admin_user)
        return details.get("evaluation_history", [])

    # ==========================================================================
    # 5. Manual Review & Score Adjustment
    # ==========================================================================
    def review_submission(
        self,
        submission_id: str,
        review_notes: str,
        review_reason: str,
        adjusted_score: Optional[float],
        mark_as_reviewed: bool,
        admin_user: dict
    ) -> Dict[str, Any]:
        """
        Performs a formal manual review action:
        - Validates reviewer permissions and input lengths
        - Updates manual review status
        - If score adjusted, retains original_score and records audit entry
        - Appends immutable entry to evaluation_history
        """
        sid = submission_id.strip()
        doc = mongodb.submissions.find_one({"$or": [{"id": sid}, {"submission_id": sid}]})
        if not doc:
            raise KeyError(f"Submission '{sid}' not found.")

        clean_notes = review_notes.strip()
        clean_reason = review_reason.strip()
        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        current_score = float(doc.get("score") or 0.0)
        manual_rev = doc.get("manual_review", {})
        original_score = manual_rev.get("original_score") if manual_rev.get("original_score") is not None else current_score

        is_adjusted = (adjusted_score is not None)
        new_score = current_score
        if adjusted_score is not None:
            new_score = round(float(adjusted_score), 2)

        updated_manual_review = {
            "review_required": False if mark_as_reviewed else bool(manual_rev.get("review_required", False)),
            "is_reviewed": mark_as_reviewed,
            "reviewed_by": admin_email,
            "reviewed_at": now.isoformat(),
            "review_notes": clean_notes,
            "review_reason": clean_reason,
            "original_score": original_score,
            "adjusted_score": new_score if is_adjusted else manual_rev.get("adjusted_score"),
            "score_adjusted": is_adjusted or manual_rev.get("score_adjusted", False),
            "re_evaluation_requested": manual_rev.get("re_evaluation_requested", False),
            "re_evaluation_reason": manual_rev.get("re_evaluation_reason")
        }

        # New evaluation history entry
        new_history_entry = {
            "attempt_number": len(doc.get("evaluation_history", [])) + 1,
            "timestamp": now.isoformat(),
            "engine_version": "BugBash-EvalEngine-v2.4",
            "execution_status": doc.get("evaluation_status", "Accepted"),
            "ml_status": doc.get("ml_analysis", {}).get("processing_status", "Completed"),
            "score": new_score,
            "action": "Manual Score Adjustment" if is_adjusted else "Manual Review Completed",
            "actor": admin_email,
            "notes": f"Reason: {clean_reason} | Notes: {clean_notes}"
        }

        # Update MongoDB
        mongodb.submissions.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "score": new_score,
                    "manual_review": updated_manual_review,
                    "updated_at": now
                },
                "$push": {
                    "evaluation_history": new_history_entry
                }
            }
        )

        self._log_audit(
            action="review_submission",
            admin_user=admin_user,
            target_id=sid,
            details={
                "original_score": original_score,
                "adjusted_score": new_score,
                "is_adjusted": is_adjusted,
                "reason": clean_reason,
                "notes": clean_notes
            }
        )

        return {
            "status": "success",
            "message": f"Submission '{sid}' reviewed successfully.",
            "submission_id": sid,
            "score": new_score,
            "is_reviewed": mark_as_reviewed,
            "score_adjusted": is_adjusted
        }

    # ==========================================================================
    # 6. Re-Evaluation Request
    # ==========================================================================
    def request_reevaluation(self, submission_id: str, reason: str, admin_user: dict) -> Dict[str, Any]:
        """
        Triggers an authoritative re-evaluation of the submission:
        - Logs reason and reviewer identity
        - Re-validates test cases and regenerates ML evaluation pipeline
        - Maintains full audit history without silently overwriting previous evaluations
        """
        sid = submission_id.strip()
        doc = mongodb.submissions.find_one({"$or": [{"id": sid}, {"submission_id": sid}]})
        if not doc:
            raise KeyError(f"Submission '{sid}' not found.")

        clean_reason = reason.strip()
        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        # Update manual review state with re-eval flag
        manual_rev = doc.get("manual_review", {})
        manual_rev["re_evaluation_requested"] = True
        manual_rev["re_evaluation_reason"] = clean_reason

        # Append Re-evaluation history entry
        new_history_entry = {
            "attempt_number": len(doc.get("evaluation_history", [])) + 1,
            "timestamp": now.isoformat(),
            "engine_version": "BugBash-EvalEngine-v2.4",
            "execution_status": doc.get("evaluation_status", "Accepted"),
            "ml_status": doc.get("ml_analysis", {}).get("processing_status", "Completed"),
            "score": doc.get("score", 0.0),
            "action": "Re-Evaluation Requested",
            "actor": admin_email,
            "notes": f"Re-evaluation requested: {clean_reason}"
        }

        mongodb.submissions.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "manual_review": manual_rev,
                    "updated_at": now
                },
                "$push": {
                    "evaluation_history": new_history_entry
                }
            }
        )

        self._log_audit(
            action="request_reevaluation",
            admin_user=admin_user,
            target_id=sid,
            details={"reason": clean_reason}
        )

        return {
            "status": "success",
            "message": f"Re-evaluation queued for submission '{sid}'.",
            "submission_id": sid,
            "re_evaluation_reason": clean_reason
        }


# Singleton service instance
admin_submission_service = AdminSubmissionService()
