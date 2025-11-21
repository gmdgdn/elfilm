"""
Sample HTML data from Dhliz for testing and demonstration.
"""

# Sample HTML for year 1950 page
YEAR_1950_HTML = """
<!DOCTYPE html>
<html>
<head><title>أفلام عام 1950</title></head>
<body>
<div class="content">
<h2>أفلام إنتاج عام 1950</h2>
<div class="films-list">
<a href="/film/aakher_kedba/">آخر كدبة (1950)</a>
<p>فيلم كوميدي مصري كلاسيكي... (المزيد)</p>

<a href="/film/leila_banat/">ليلة البنات (1950)</a>
<p>درام مصري قديم عن الحب والزواج... (المزيد)</p>

<a href="/film/shabab_imraa/">شباب امرأة (1950)</a>
<p>فيلم درامي مصري... (المزيد)</p>
</div>
</div>
</body>
</html>
"""

# Sample HTML for English film page: Aakher Kedba
FILM_EN_HTML = """
<!DOCTYPE html>
<html>
<head><title>Aakher Kedba - Dhliz</title></head>
<body>
<h1>Aakher Kedba</h1>
<h2>آخر كدبة</h2>

<div class="about">
<p>Production year: 1950</p>
<p>Type: Black and White</p>
<p>Duration: 115 minutes</p>
<p>Genre(s): Comedy, Drama</p>
</div>

<div class="crew">
<h3>Screenwriter</h3>
<p>Abo-Al-Seoud Al-Ibiary</p>

<h3>Screenplay</h3>
<p>Ahmad Badrakhan</p>

<h3>Dialogue</h3>
<p>Abo-Al-Seoud Al-Ibiary</p>

<h3>Producer</h3>
<p>Farid Al-Atrash Films</p>

<h3>Director</h3>
<p>Ahmad Badrakhan</p>
</div>

<div class="cast">
<h3>Cast</h3>
<a href="/actor/farid-al-atrash/">Farid Al-Atrash</a> 8.0
<br>
<a href="/actor/samya-gamal/">Samya Gamal</a>
<br>
<a href="/actor/ismail-yassine/">Ismail Yassine</a> 7.0
</div>

<div class="tags">
<h3>Tags (5)</h3>
<p>marriage, male singer, female dancer, comedy, drama</p>
</div>
</body>
</html>
"""

# Sample HTML for Arabic film page: Aakher Kedba
FILM_AR_HTML = """
<!DOCTYPE html>
<html>
<head><title>آخر كدبة - ضلك</title></head>
<body>
<h1>آخر كدبة</h1>

<div class="story">
<h3>القصة:</h3>
<p>فيلم كوميدي مصري رائع يحكي قصة شاب مصري يعشق فتاة جميلة لكن والداها يرفضان زواجه منها. يحاول الشاب خداع والديها بأكاذيب عديدة لكن كل أكذوبة تفضح الأخرى في سلسلة كوميدية طريفة.</p>
</div>

<div class="attributes">
<h3>سمات</h3>
<p>زواج, مطرب, راقصة, كوميديا, درام</p>
</div>

<div class="cast">
<h3>البطولة</h3>
<a href="/actor/farid-al-atrash/">فريد الأطرش</a> 8.0
<br>
<a href="/actor/samya-gamal/">سامية جمال</a>
<br>
<a href="/actor/ismail-yassine/">إسماعيل ياسين</a> 7.0
</div>
</body>
</html>
"""
