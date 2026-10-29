terraform {
  required_version = ">= 1.6"
}

provider "aws" {
  region = "eu-west-3"
}

variable "ssh_key_name" {
  type = string
}

# Un seul serveur : nginx + docker compose (voir docker-compose.prod.yml).
resource "aws_instance" "app" {
  ami           = "ami-0f3c9c466bb525749"
  instance_type = "t3.small"
  key_name      = var.ssh_key_name
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = { Name = "reference-app" }
}

resource "aws_security_group" "web" {
  name = "reference-web"
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Ressources statiques (e-mails, pièces jointes) et CDN devant.
resource "aws_s3_bucket" "assets" {
  bucket = "reference-assets"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled = true
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "assets"
  }
  origin {
    domain_name = aws_instance.app.public_dns
    origin_id   = "app"
  }
  default_cache_behavior {
    target_origin_id       = "app"
    viewer_protocol_policy = "redirect-to-https"
  }
}

resource "aws_route53_record" "www" {
  zone_id = var.zone_id
  name    = "reference.rypha.io"
  type    = "A"
  alias {
    name    = aws_cloudfront_distribution.cdn.domain_name
    zone_id = aws_cloudfront_distribution.cdn.hosted_zone_id
  }
}
