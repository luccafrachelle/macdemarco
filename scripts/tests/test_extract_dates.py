from datetime import date
from scripts.extract_dates import extract_date

def test_yyyymmdd(): assert extract_date("20190805 Mac Baby") == date(2019, 8, 5)
def test_yyyymmdd_only(): assert extract_date("20180914") == date(2018, 9, 14)
def test_impossible_date_rejected(): assert extract_date("20190231 Song") is None
def test_leap_day(): assert extract_date("20200229") == date(2020, 2, 29)
def test_non_leap_feb29_rejected(): assert extract_date("20190229") is None
def test_long_number_not_date(): assert extract_date("20191231000") is None
def test_iso_separators(): assert extract_date("Demo 2015-03-07") == date(2015, 3, 7)
def test_month_name_sept(): assert extract_date("Sept 13th Jam") == date(2000, 9, 13)
def test_month_name_full(): assert extract_date("September 13") == date(2000, 9, 13)
def test_month_abbrev(): assert extract_date("jan. 2nd") == date(2000, 1, 2)
def test_ambiguous_slash_ignored(): assert extract_date("3/4") is None
def test_plain_numbers_ignored():
    for t in ["2", "1000", "Chamber of Reflection 2014 Demo", "Salad Days"]:
        assert extract_date(t) is None
