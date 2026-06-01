from django.db import migrations, models


def populate_disease_categories(apps, schema_editor):
    DiseaseRecord = apps.get_model("piggery", "DiseaseRecord")

    # Inline copy of DISEASE_TO_CATEGORY mapping
    # (can't import the service at migration time)
    DISEASE_TO_CATEGORY = {
        # respiratory
        "swine influenza": "respiratory",
        "mycoplasma pneumonia": "respiratory",
        "prrs (porcine reproductive & respiratory syndrome)": "respiratory",
        "prrs": "respiratory",
        "porcine reproductive & respiratory syndrome": "respiratory",
        "actinobacillus pleuropneumonia (app)": "respiratory",
        "actinobacillus pleuropneumonia": "respiratory",
        "enzootic pneumonia": "respiratory",
        "pasteurellosis": "respiratory",
        "bordetellosis (atrophic rhinitis)": "respiratory",
        "atrophic rhinitis": "respiratory",
        # digestive
        "colibacillosis (e. coli infection)": "digestive",
        "colibacillosis": "digestive",
        "e. coli": "digestive",
        "salmonellosis": "digestive",
        "swine dysentery": "digestive",
        "ileitis (porcine proliferative enteropathy)": "digestive",
        "ileitis": "digestive",
        "transmissible gastroenteritis (tge)": "digestive",
        "tge": "digestive",
        "porcine epidemic diarrhea (ped)": "digestive",
        "ped": "digestive",
        "rotavirus infection": "digestive",
        # skin
        "mange (sarcoptic)": "skin",
        "mange": "skin",
        "ringworm (dermatophytosis)": "skin",
        "ringworm": "skin",
        "greasy pig disease (exudative epidermitis)": "skin",
        "greasy pig disease": "skin",
        "swine pox": "skin",
        "foot-and-mouth disease (fmd)": "skin",
        "fmd": "skin",
        # reproductive
        "mastitis": "reproductive",
        "metritis": "reproductive",
        "agalactia (mma syndrome)": "reproductive",
        "agalactia": "reproductive",
        "mma": "reproductive",
        "brucellosis": "reproductive",
        "leptospirosis": "reproductive",
        "parvovirus infection": "reproductive",
        # parasitic
        "internal worms (ascariasis)": "parasitic",
        "internal worms": "parasitic",
        "roundworms": "parasitic",
        "lungworms": "parasitic",
        "lice (pediculosis)": "parasitic",
        "lice": "parasitic",
        "mites": "parasitic",
        "coccidiosis": "parasitic",
        "toxoplasmosis": "parasitic",
        # nutritional
        "vitamin a deficiency": "nutritional",
        "vitamin e / selenium deficiency": "nutritional",
        "vitamin deficiency": "nutritional",
        "iron deficiency anemia": "nutritional",
        "mineral deficiency": "nutritional",
        "calcium / phosphorus imbalance": "nutritional",
        "zinc deficiency (parakeratosis)": "nutritional",
        "salt poisoning (water deprivation)": "nutritional",
        # systemic
        "african swine fever (asf)": "systemic",
        "asf": "systemic",
        "hog cholera (classical swine fever)": "systemic",
        "hog cholera": "systemic",
        "erysipelas": "systemic",
        "meningitis (streptococcal)": "systemic",
        "septicemia": "systemic",
        "fever (unknown origin)": "systemic",
        "fever": "systemic",
        "lameness (unknown cause)": "systemic",
        "lameness": "systemic",
        "injury / trauma": "systemic",
        "injury": "systemic",
        "heat stress": "systemic",
        "dehydration": "systemic",
    }

    for record in DiseaseRecord.objects.all():
        cat = DISEASE_TO_CATEGORY.get(record.disease_name.lower().strip(), "systemic")
        record.disease_category = cat
        record.save(update_fields=["disease_category"])


class Migration(migrations.Migration):

    dependencies = [
        ("piggery", "0008_alter_feedusagelog_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="diseaserecord",
            name="disease_category",
            field=models.CharField(
                choices=[
                    ("respiratory",  "Respiratory"),
                    ("digestive",    "Digestive"),
                    ("skin",         "Skin & External"),
                    ("reproductive", "Reproductive"),
                    ("parasitic",    "Parasitic"),
                    ("nutritional",  "Nutritional"),
                    ("systemic",     "Systemic / Other"),
                ],
                default="systemic",
                max_length=30,
                help_text="Structured disease category for analytics and reporting",
            ),
        ),
        migrations.RunPython(populate_disease_categories, migrations.RunPython.noop),
    ]